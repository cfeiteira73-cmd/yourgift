import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventBusService } from '../events/event-bus.service';

interface StepDefinition {
  id: string;
  name: string;
  action: string;
  nextOnSuccess: string | null;
  nextOnFail: string | null;
  canCompensate: boolean;
  compensateAction?: string;
  maxAttempts: number;
  timeoutSeconds: number;
}

@Injectable()
export class WorkflowEngineService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventBusService,
  ) {}

  onModuleInit() {
    // Subscribe to key trigger events explicitly
    const triggers = ['order.created', 'order.flagged'];
    for (const event of triggers) {
      this.events.on(event, async (payload: Record<string, unknown>) => {
        await this.triggerWorkflows(event, payload);
      });
    }

    this.logger.log('Workflow engine initialized');
  }

  async triggerWorkflows(eventType: string, payload: Record<string, unknown>): Promise<void> {
    const definitions = await this.prisma.workflowDefinition.findMany({
      where: { triggerEvent: eventType, isActive: true },
    });

    for (const def of definitions) {
      try {
        await this.startWorkflow(def.id, payload);
      } catch (err) {
        this.logger.error(`Failed to start workflow ${def.name}: ${err}`);
      }
    }
  }

  async startWorkflow(definitionId: string, triggerPayload: Record<string, unknown>): Promise<string> {
    const def = await this.prisma.workflowDefinition.findUniqueOrThrow({ where: { id: definitionId } });
    const dag = def.dag as unknown as StepDefinition[];
    const firstStep = dag[0];
    if (!firstStep) throw new Error(`Workflow ${def.name} has empty DAG`);

    const instance = await this.prisma.workflowInstance.create({
      data: {
        definitionId: def.id,
        definitionName: def.name,
        triggerPayload: triggerPayload as object,
        currentStep: firstStep.id,
        context: triggerPayload as object,
      },
    });

    // Initialize all step states as 'pending'
    await this.prisma.workflowStepState.createMany({
      data: dag.map(step => ({
        instanceId: instance.id,
        stepId: step.id,
        stepName: step.name,
        maxAttempts: step.maxAttempts,
        input: triggerPayload as object,
      })),
    });

    this.logger.log(`Workflow started: ${def.name} [${instance.id}]`);

    // Execute first step asynchronously
    void this.executeStep(instance.id, firstStep.id, dag, triggerPayload);

    return instance.id;
  }

  private async executeStep(
    instanceId: string,
    stepId: string,
    dag: StepDefinition[],
    context: Record<string, unknown>,
  ): Promise<void> {
    const stepDef = dag.find(s => s.id === stepId);
    if (!stepDef) {
      await this.completeInstance(instanceId, 'completed');
      return;
    }

    const stepState = await this.prisma.workflowStepState.update({
      where: { instanceId_stepId: { instanceId, stepId } },
      data: { status: 'running', startedAt: new Date(), input: context as object },
    });

    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { currentStep: stepId },
    });

    try {
      // Execute action by emitting to event bus
      const result = await this.executeAction(stepDef.action, context);

      await this.prisma.workflowStepState.update({
        where: { instanceId_stepId: { instanceId, stepId } },
        data: { status: 'completed', completedAt: new Date(), output: result as object },
      });

      const nextContext = { ...context, ...result };

      if (stepDef.nextOnSuccess) {
        await this.executeStep(instanceId, stepDef.nextOnSuccess, dag, nextContext);
      } else {
        await this.completeInstance(instanceId, 'completed');
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const currentAttempt = stepState.attempt;

      if (currentAttempt < stepState.maxAttempts) {
        // Retry
        await this.prisma.workflowStepState.update({
          where: { instanceId_stepId: { instanceId, stepId } },
          data: { status: 'pending', attempt: currentAttempt + 1, error },
        });
        this.logger.warn(`Step ${stepId} retry ${currentAttempt + 1}/${stepState.maxAttempts}`);
        // Retry with exponential backoff
        setTimeout(() => void this.executeStep(instanceId, stepId, dag, context), currentAttempt * 2000);
      } else {
        await this.prisma.workflowStepState.update({
          where: { instanceId_stepId: { instanceId, stepId } },
          data: { status: 'failed', completedAt: new Date(), error },
        });

        if (stepDef.nextOnFail) {
          await this.executeStep(instanceId, stepDef.nextOnFail, dag, { ...context, failedStep: stepId, error });
        } else {
          // Trigger compensation chain
          if (stepDef.canCompensate) {
            await this.compensate(instanceId, dag, context);
          } else {
            await this.completeInstance(instanceId, 'failed', error);
          }
        }
      }
    }
  }

  private async executeAction(action: string, context: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Emit action event — action handlers listen on event bus
    this.events.emit(action, context);
    return { action, executedAt: new Date().toISOString(), status: 'emitted' };
  }

  private async compensate(instanceId: string, dag: StepDefinition[], context: Record<string, unknown>): Promise<void> {
    await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { status: 'compensating' } });

    // Compensate completed steps in reverse order
    const completedSteps = await this.prisma.workflowStepState.findMany({
      where: { instanceId, status: 'completed' },
      orderBy: { completedAt: 'desc' },
    });

    for (const step of completedSteps) {
      const def = dag.find(d => d.id === step.stepId);
      if (def?.canCompensate && def.compensateAction) {
        try {
          this.events.emit(def.compensateAction, context);
          await this.prisma.workflowStepState.update({
            where: { id: step.id },
            data: { status: 'compensated' },
          });
          this.logger.log(`Compensated step: ${step.stepName}`);
        } catch (e) {
          this.logger.error(`Compensation failed for ${step.stepName}: ${e}`);
        }
      }
    }

    await this.completeInstance(instanceId, 'failed', 'Compensated after failure');
  }

  private async completeInstance(instanceId: string, status: 'completed' | 'failed', error?: string): Promise<void> {
    await this.prisma.workflowInstance.update({
      where: { id: instanceId },
      data: { status, completedAt: new Date(), ...(error ? { error } : {}) },
    });
    this.logger.log(`Workflow ${instanceId}: ${status}`);
  }

  async getInstances(filters: { status?: string; definitionName?: string; limit?: number }) {
    return this.prisma.workflowInstance.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.definitionName ? { definitionName: filters.definitionName } : {}),
      },
      include: { steps: { orderBy: { startedAt: 'asc' } } },
      orderBy: { startedAt: 'desc' },
      take: filters.limit ?? 50,
    });
  }

  async getInstance(instanceId: string) {
    return this.prisma.workflowInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { definition: true, steps: { orderBy: { startedAt: 'asc' } } },
    });
  }

  async getDefinitions() {
    return this.prisma.workflowDefinition.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async getStats() {
    const [total, byStatus] = await Promise.all([
      this.prisma.workflowInstance.count(),
      this.prisma.workflowInstance.groupBy({ by: ['status'], _count: { id: true } }),
    ]);
    const statusMap = Object.fromEntries(byStatus.map(s => [s.status, s._count.id]));
    return { total, byStatus: statusMap };
  }

  async retryInstance(instanceId: string): Promise<void> {
    const instance = await this.prisma.workflowInstance.findUniqueOrThrow({
      where: { id: instanceId },
      include: { definition: true },
    });
    const dag = instance.definition.dag as unknown as StepDefinition[];
    const failedStep = await this.prisma.workflowStepState.findFirst({
      where: { instanceId, status: 'failed' },
    });
    if (!failedStep) throw new Error('No failed step to retry');

    await this.prisma.workflowInstance.update({ where: { id: instanceId }, data: { status: 'running', error: null } });
    await this.prisma.workflowStepState.update({
      where: { id: failedStep.id },
      data: { status: 'pending', attempt: 1, error: null },
    });

    const context = instance.context as Record<string, unknown>;
    void this.executeStep(instanceId, failedStep.stepId, dag, context);
  }
}
