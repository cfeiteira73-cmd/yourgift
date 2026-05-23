import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EventBusModule } from '../events/event-bus.module';
import { EmployeeWalletService } from './employee-wallet.service';
import { ProcurementRequestService } from './procurement-request.service';
import { OnboardingKitService } from './onboarding-kit.service';
import { DepartmentBudgetService } from './department-budget.service';
import { EmployeePortalController } from './employee-portal.controller';

@Module({
  imports: [PrismaModule, EventBusModule],
  controllers: [EmployeePortalController],
  providers: [
    EmployeeWalletService,
    ProcurementRequestService,
    OnboardingKitService,
    DepartmentBudgetService,
  ],
  exports: [
    EmployeeWalletService,
    ProcurementRequestService,
    OnboardingKitService,
    DepartmentBudgetService,
  ],
})
export class EmployeePortalModule {}
