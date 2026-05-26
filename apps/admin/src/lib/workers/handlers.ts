/**
 * Worker handler registrations.
 *
 * This file is imported as a side-effect by API routes that need workers to
 * be active. Each call to registerWorkerHandler() binds a WorkerName to the
 * function that processes a single job from that queue.
 *
 * Keep handlers thin — delegate heavy logic to service modules or the NestJS
 * API via internal HTTP calls so this file stays easy to extend.
 */
import { registerWorkerHandler } from './processor'

const API_BASE = process.env.INTERNAL_API_URL ?? 'http://localhost:3001'

// --- midocean-sync ---
// Triggers a full or incremental product sync from the Midocean API.
registerWorkerHandler('midocean-sync', async (job) => {
  const { mode = 'incremental' } = job.payload as { mode?: 'full' | 'incremental' }

  const res = await fetch(`${API_BASE}/api/v1/suppliers/midocean/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
    body: JSON.stringify({ mode }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`midocean-sync failed (${res.status}): ${text}`)
  }
})

// --- pf-sync ---
// Triggers a full or incremental product sync from the PF Concept API.
registerWorkerHandler('pf-sync', async (job) => {
  const { mode = 'incremental' } = job.payload as { mode?: 'full' | 'incremental' }

  const res = await fetch(`${API_BASE}/api/v1/suppliers/pf/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
    body: JSON.stringify({ mode }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`pf-sync failed (${res.status}): ${text}`)
  }
})

// --- order-fulfillment ---
// Submits a single pending order to the relevant supplier.
registerWorkerHandler('order-fulfillment', async (job) => {
  const { orderId } = job.payload as { orderId: string }

  if (!orderId) throw new Error('order-fulfillment: missing orderId in job payload')

  const res = await fetch(`${API_BASE}/api/v1/orders/${orderId}/fulfill`, {
    method: 'POST',
    headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`order-fulfillment failed for order ${orderId} (${res.status}): ${text}`)
  }
})

// --- artwork-processing ---
// Validates and processes an uploaded artwork file.
registerWorkerHandler('artwork-processing', async (job) => {
  const { artworkId } = job.payload as { artworkId: string }

  if (!artworkId) throw new Error('artwork-processing: missing artworkId in job payload')

  const res = await fetch(`${API_BASE}/api/v1/artwork/${artworkId}/process`, {
    method: 'POST',
    headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`artwork-processing failed for artwork ${artworkId} (${res.status}): ${text}`)
  }
})

// --- email-notifications ---
// Sends a queued transactional email via the API (which delegates to Resend).
registerWorkerHandler('email-notifications', async (job) => {
  const { notificationId } = job.payload as { notificationId: string }

  if (!notificationId) throw new Error('email-notifications: missing notificationId in job payload')

  const res = await fetch(`${API_BASE}/api/v1/notifications/${notificationId}/send`, {
    method: 'POST',
    headers: { 'x-internal-token': process.env.INTERNAL_TOKEN ?? '' },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`email-notifications failed for notification ${notificationId} (${res.status}): ${text}`)
  }
})
