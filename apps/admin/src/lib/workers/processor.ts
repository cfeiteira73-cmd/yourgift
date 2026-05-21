import type { WorkerName, WorkerResult, AllQueuesResult, WorkerHandler, WorkerJob } from './types'
import { WORKER_REGISTRY } from './types'

// --- Handler registry ---

const handlerRegistry = new Map<WorkerName, WorkerHandler>()

export function registerWorkerHandler(workerName: WorkerName, handler: WorkerHandler): void {
  handlerRegistry.set(workerName, handler)
}

// --- Queue abstraction ---
// In production this would pull from a real queue (SQS, BullMQ, etc.).
// For now it uses a lightweight in-memory queue backed by a Map so the
// system is fully functional without external dependencies.

interface QueueEntry {
  jobs: WorkerJob[]
}

const inMemoryQueues = new Map<WorkerName, QueueEntry>()

function getQueue(workerName: WorkerName): QueueEntry {
  if (!inMemoryQueues.has(workerName)) {
    inMemoryQueues.set(workerName, { jobs: [] })
  }
  return inMemoryQueues.get(workerName)!
}

export function enqueueJob(workerName: WorkerName, payload: Record<string, unknown>): string {
  const id = `${workerName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const job: WorkerJob = { id, payload, attempts: 0, createdAt: new Date() }
  getQueue(workerName).jobs.push(job)
  return id
}

// --- Core processor ---

/**
 * Process up to `limit` jobs from the named worker's queue.
 * Handlers must be registered via registerWorkerHandler() before calling this.
 */
export async function processQueue(
  workerName: WorkerName,
  limit = 10,
): Promise<WorkerResult> {
  const start = Date.now()
  const handler = handlerRegistry.get(workerName)
  const queue = getQueue(workerName)

  if (!handler) {
    // No handler registered — log and return empty result rather than throw,
    // so the cron endpoint can continue processing other queues.
    console.warn(`[worker] No handler registered for "${workerName}"`)
    return { processed: 0, succeeded: 0, failed: 0, durationMs: Date.now() - start }
  }

  const batch = queue.jobs.splice(0, limit)
  let succeeded = 0
  let failed = 0

  for (const job of batch) {
    job.attempts += 1
    try {
      await handler(job)
      succeeded++
    } catch (err) {
      failed++
      console.error(`[worker] Job ${job.id} failed (attempt ${job.attempts}):`, err)
      // Re-queue for retry if under max attempts
      if (job.attempts < 3) {
        queue.jobs.push(job)
      }
    }
  }

  const result: WorkerResult = {
    processed: batch.length,
    succeeded,
    failed,
    durationMs: Date.now() - start,
  }

  console.log(`[worker] ${workerName}: processed=${result.processed} ok=${succeeded} fail=${failed} (${result.durationMs}ms)`)
  return result
}

/**
 * Process all registered worker queues using their default limits.
 * Results are keyed by worker name.
 */
export async function processAllQueues(): Promise<AllQueuesResult> {
  const results: AllQueuesResult = {}

  await Promise.all(
    Object.keys(WORKER_REGISTRY).map(async (name) => {
      const workerName = name as WorkerName
      const config = WORKER_REGISTRY[workerName]
      try {
        results[workerName] = await processQueue(workerName, config.defaultLimit)
      } catch (err) {
        results[workerName] = { error: err instanceof Error ? err.message : String(err) }
      }
    }),
  )

  return results
}
