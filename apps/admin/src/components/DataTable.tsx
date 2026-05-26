'use client';

import type { ReactNode } from 'react';
import { useState, useCallback } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  render?: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  getKey: (row: T) => string;
}

function SkeletonRow({ cols }: { cols: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-5 py-4">
          <div className="skeleton h-4 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
        </td>
      ))}
    </tr>
  );
}

export default function DataTable<T>({
  columns,
  data,
  loading = false,
  pageSize = 20,
  onRowClick,
  emptyMessage = 'Sem dados disponíveis',
  getKey,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortAsc((a) => !a);
      } else {
        setSortKey(key);
        setSortAsc(true);
      }
      setPage(0);
    },
    [sortKey]
  );

  const sorted = [...data].sort((a: any, b: any) => {
    if (!sortKey) return 0;
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av == null) return 1;
    if (bv == null) return -1;
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortAsc ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sorted.length / pageSize);
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="rounded-xl border border-[#1a2f48] bg-[#0b1526] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#1a2f48]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#4d6a87] ${
                    col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                  } ${col.sortable ? 'cursor-pointer select-none hover:text-[#8ba8c7] transition-colors' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span className="text-[#4da3ff]">{sortAsc ? '↑' : '↓'}</span>
                    )}
                    {col.sortable && sortKey !== col.key && (
                      <span className="opacity-30">↕</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#102131]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} cols={columns.length} />
              ))
            ) : paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-5 py-16 text-center text-[#4d6a87] text-sm">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paged.map((row) => (
                <tr
                  key={getKey(row)}
                  className={`transition-colors ${
                    onRowClick
                      ? 'cursor-pointer hover:bg-[#102131]'
                      : 'hover:bg-[#0e1c2e]'
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`px-5 py-4 text-sm ${
                        col.align === 'right'
                          ? 'text-right'
                          : col.align === 'center'
                          ? 'text-center'
                          : 'text-left'
                      }`}
                    >
                      {col.render ? col.render(row) : (row as any)[col.key] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-[#1a2f48] bg-[#0b1526]">
          <span className="text-xs text-[#4d6a87]">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, sorted.length)} de{' '}
            {sorted.length} resultados
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="px-2 py-1 rounded text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
              onClick={() => setPage(0)}
              disabled={page === 0}
            >
              «
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ‹
            </button>
            {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
              const pageNum = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
              return (
                <button
                  key={pageNum}
                  type="button"
                  className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-[#4da3ff] text-white'
                      : 'text-[#8ba8c7] hover:bg-[#102131]'
                  }`}
                  onClick={() => setPage(pageNum)}
                >
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              type="button"
              className="px-2 py-1 rounded text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              ›
            </button>
            <button
              type="button"
              className="px-2 py-1 rounded text-xs text-[#8ba8c7] hover:bg-[#102131] disabled:opacity-30 transition-colors"
              onClick={() => setPage(totalPages - 1)}
              disabled={page >= totalPages - 1}
            >
              »
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
