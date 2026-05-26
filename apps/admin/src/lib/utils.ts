/**
 * Format a number as currency in Portuguese format (€1.234,56)
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a date to PT locale short format
 */
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Format a datetime to PT locale with time
 */
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns elapsed time string like "2h 14m ago"
 */
export function timeAgo(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}m atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m atrás` : `${hours}h atrás`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

/**
 * Compute % change between two values
 */
export function pctChange(current: number, previous: number): number {
  if (previous === 0) return 0;
  return ((current - previous) / previous) * 100;
}

/**
 * Returns the admin bearer token from localStorage (client only)
 */
export function getAdminToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('adminToken') ?? '';
}

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
