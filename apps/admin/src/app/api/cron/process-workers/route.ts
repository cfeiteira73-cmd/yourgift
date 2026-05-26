import { NextRequest, NextResponse } from 'next/server'
import { processAllQueues } from '@/lib/workers/processor'

// Ensure worker handlers are registered before any route runs
import '@/lib/workers/handlers'

export const runtime = 'nodejs'

/**
 * GET /api/cron/process-workers
 *
 * Vercel Cron endpoint — processes all registered worker queues in parallel.
 * Configured in vercel.json under the "crons" key.
 *
 * Vercel passes Authorization: Bearer <CRON_SECRET> automatically when the
 * cron job fires. The same token can be used for local testing.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = new Date().toISOString()
  const results = await processAllQueues()

  const totalProcessed = Object.values(results).reduce(
    (sum, r) => sum + ('processed' in r ? r.processed : 0),
    0,
  )
  const totalFailed = Object.values(results).reduce(
    (sum, r) => sum + ('failed' in r ? r.failed : 0),
    0,
  )

  return NextResponse.json({
    ok: true,
    startedAt,
    finishedAt: new Date().toISOString(),
    totalProcessed,
    totalFailed,
    queues: results,
  })
}
