import { NextRequest, NextResponse } from 'next/server'
import { processQueue } from '@/lib/workers/processor'
import { WORKER_REGISTRY } from '@/lib/workers/types'
import type { WorkerName } from '@/lib/workers/types'

// Ensure worker handlers are registered before any route runs
import '@/lib/workers/handlers'

export const runtime = 'nodejs'

/**
 * POST /api/workers/run
 * Body: { worker: WorkerName, limit?: number }
 *
 * Manually trigger a single worker queue. Useful for admin one-off runs
 * and for testing individual workers in development.
 *
 * Protected by CRON_SECRET (same token as cron routes) so it cannot be
 * called by unauthorized parties.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { worker?: string; limit?: number }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { worker, limit } = body

  if (!worker) {
    return NextResponse.json(
      { error: 'Missing required field: worker', validWorkers: Object.keys(WORKER_REGISTRY) },
      { status: 400 },
    )
  }

  if (!(worker in WORKER_REGISTRY)) {
    return NextResponse.json(
      { error: `Unknown worker: "${worker}"`, validWorkers: Object.keys(WORKER_REGISTRY) },
      { status: 400 },
    )
  }

  const result = await processQueue(worker as WorkerName, limit ?? 10)

  return NextResponse.json({
    ok: true,
    worker,
    ...result,
  })
}

/**
 * GET /api/workers/run
 * Returns the list of registered workers and their config.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ workers: WORKER_REGISTRY })
}
