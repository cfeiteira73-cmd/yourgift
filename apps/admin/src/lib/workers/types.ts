export type WorkerName =
  | 'midocean-sync'
  | 'pf-sync'
  | 'order-fulfillment'
  | 'artwork-processing'
  | 'email-notifications'

export interface WorkerConfig {
  name: WorkerName
  description: string
  cronSchedule: string
  defaultLimit: number
}

export interface WorkerResult {
  processed: number
  succeeded: number
  failed: number
  durationMs: number
}

export interface AllQueuesResult {
  [workerName: string]: WorkerResult | { error: string }
}

export type WorkerHandler = (job: WorkerJob) => Promise<void>

export interface WorkerJob {
  id: string
  payload: Record<string, unknown>
  attempts: number
  createdAt: Date
}

export const WORKER_REGISTRY: Record<WorkerName, WorkerConfig> = {
  'midocean-sync': {
    name: 'midocean-sync',
    description: 'Sincronizar catálogo Midocean (produtos + preços + stock)',
    cronSchedule: '0 */6 * * *',
    defaultLimit: 100,
  },
  'pf-sync': {
    name: 'pf-sync',
    description: 'Sincronizar catálogo PF Concept',
    cronSchedule: '30 */6 * * *',
    defaultLimit: 100,
  },
  'order-fulfillment': {
    name: 'order-fulfillment',
    description: 'Processar encomendas pendentes e submeter a fornecedores',
    cronSchedule: '*/5 * * * *',
    defaultLimit: 10,
  },
  'artwork-processing': {
    name: 'artwork-processing',
    description: 'Processar e validar ficheiros de artwork submetidos',
    cronSchedule: '*/2 * * * *',
    defaultLimit: 20,
  },
  'email-notifications': {
    name: 'email-notifications',
    description: 'Enviar notificações de email em fila',
    cronSchedule: '*/1 * * * *',
    defaultLimit: 50,
  },
}
