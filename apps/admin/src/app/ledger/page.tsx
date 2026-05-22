'use client';
import { useState, useEffect, useCallback } from 'react';

interface TrialBalanceAccount {
  code: string;
  name: string;
  accountType: string;
  normalBalance: string;
  balance: number;
  debits: number;
  credits: number;
}

interface TrialBalance {
  accounts: TrialBalanceAccount[];
  totalDebits: number;
  totalCredits: number;
  isBalanced: boolean;
}

interface PnL {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  totalExpenses: number;
  netIncome: number;
}

interface LedgerEntry {
  id: string;
  accountCode: string;
  entryType: string;
  amount: number;
  description: string;
  postedAt: string;
}

interface LedgerTransaction {
  id: string;
  description: string;
  referenceType?: string;
  referenceId?: string;
  totalAmount: number;
  currency: string;
  postedAt: string;
  entries: LedgerEntry[];
}

function fmt(n: number, currency = 'EUR') {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

const TYPE_COLORS: Record<string, string> = {
  asset: '#4da3ff',
  liability: '#f59e0b',
  revenue: '#22c55e',
  expense: '#ef4444',
  equity: '#a78bfa',
};

export default function LedgerPage() {
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [pnl, setPnl] = useState<PnL | null>(null);
  const [txs, setTxs] = useState<LedgerTransaction[]>([]);
  const [tab, setTab] = useState<'pnl' | 'trial' | 'transactions'>('pnl');
  const [expandedTx, setExpandedTx] = useState<string | null>(null);

  const base = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';
  const getHeaders = () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const load = useCallback(async () => {
    try {
      const [tbRes, pnlRes, txRes] = await Promise.all([
        fetch(`${base}/api/v1/ledger/trial-balance`, { headers: getHeaders() }),
        fetch(`${base}/api/v1/ledger/pnl`, { headers: getHeaders() }),
        fetch(`${base}/api/v1/ledger/transactions?limit=30`, { headers: getHeaders() }),
      ]);
      if (tbRes.ok) setTb(await tbRes.json() as TrialBalance);
      if (pnlRes.ok) setPnl(await pnlRes.json() as PnL);
      if (txRes.ok) setTxs(await txRes.json() as LedgerTransaction[]);
    } catch { /* graceful */ }
  }, [base]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div style={{ padding: '32px 40px', background: '#07111f', minHeight: '100vh', color: '#f0f6ff' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Financial Ledger</h1>
        <p style={{ color: '#8ba8c7', margin: '4px 0 0', fontSize: 14 }}>
          Double-entry accounting · SAP FI/CO simplified · Immutable audit trail
        </p>
      </div>

      {/* P&L Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'Revenue', value: pnl?.revenue ?? 0, color: '#22c55e', icon: '↑' },
          { label: 'Gross Profit', value: pnl?.grossProfit ?? 0, color: (pnl?.grossProfit ?? 0) >= 0 ? '#4da3ff' : '#ef4444', icon: '◆' },
          { label: 'Net Income', value: pnl?.netIncome ?? 0, color: (pnl?.netIncome ?? 0) >= 0 ? '#22c55e' : '#ef4444', icon: '★' },
          { label: 'COGS', value: pnl?.cogs ?? 0, color: '#ef4444', icon: '↓' },
          { label: 'Gross Margin', value: pnl?.grossMarginPct ?? 0, color: (pnl?.grossMarginPct ?? 0) >= 20 ? '#22c55e' : '#f59e0b', isPercent: true, icon: '%' },
          { label: 'Total Expenses', value: pnl?.totalExpenses ?? 0, color: '#f59e0b', icon: '−' },
        ].map(card => (
          <div key={card.label} style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ fontSize: 12, color: '#8ba8c7' }}>{card.label}</div>
              <div style={{ fontSize: 16, color: card.color, opacity: 0.6 }}>{card.icon}</div>
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color }}>
              {(card as { isPercent?: boolean }).isPercent
                ? `${card.value.toFixed(1)}%`
                : fmt(card.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Balanced indicator */}
      {tb && (
        <div style={{
          background: tb.isBalanced ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
          border: `1px solid ${tb.isBalanced ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          borderRadius: 10, padding: '12px 20px', marginBottom: 28,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <span style={{ fontSize: 18 }}>{tb.isBalanced ? '✓' : '⚠'}</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: tb.isBalanced ? '#22c55e' : '#ef4444' }}>
              {tb.isBalanced ? 'Ledger is balanced — debits = credits' : 'Ledger imbalance detected!'}
            </div>
            <div style={{ fontSize: 12, color: '#8ba8c7' }}>
              Total Debits: {fmt(tb.totalDebits)} · Total Credits: {fmt(tb.totalCredits)}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: '#0b1526', borderRadius: 10, padding: 4,
        width: 'fit-content', border: '1px solid #1a2f48',
      }}>
        {(['pnl', 'trial', 'transactions'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            fontSize: 13, fontWeight: 600, cursor: 'pointer',
            background: tab === t ? '#4da3ff' : 'transparent',
            color: tab === t ? '#07111f' : '#8ba8c7',
          }}>
            {t === 'pnl' ? 'P&L' : t === 'trial' ? 'Trial Balance' : 'Transactions'}
          </button>
        ))}
      </div>

      {/* P&L Detail */}
      {tab === 'pnl' && pnl && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, padding: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Profit &amp; Loss Statement</div>
          <div style={{ maxWidth: 480 }}>
            {[
              { label: 'Revenue', value: pnl.revenue, indent: 0, bold: false },
              { label: 'Cost of Goods Sold', value: -pnl.cogs, indent: 1, bold: false },
              { label: 'Gross Profit', value: pnl.grossProfit, indent: 0, bold: true, separator: true },
              { label: 'Operating Expenses', value: -pnl.totalExpenses, indent: 1, bold: false },
              { label: 'Net Income', value: pnl.netIncome, indent: 0, bold: true, separator: true, highlight: true },
            ].map((row, i) => (
              <div key={i}>
                {(row as { separator?: boolean }).separator && (
                  <div style={{ borderTop: '1px solid #1a2f48', margin: '8px 0' }} />
                )}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: `${(row as { highlight?: boolean }).highlight ? '10px' : '8px'} ${row.indent > 0 ? '32px' : '0px'}`,
                  borderRadius: (row as { highlight?: boolean }).highlight ? 8 : 0,
                  background: (row as { highlight?: boolean }).highlight ? 'rgba(77,163,255,0.08)' : 'transparent',
                }}>
                  <span style={{
                    fontSize: row.bold ? 14 : 13,
                    fontWeight: row.bold ? 700 : 400,
                    color: row.bold ? '#f0f6ff' : '#8ba8c7',
                  }}>
                    {row.label}
                  </span>
                  <span style={{
                    fontSize: row.bold ? 16 : 14, fontWeight: row.bold ? 700 : 400,
                    color: row.value >= 0 ? (row.bold ? '#22c55e' : '#f0f6ff') : '#ef4444',
                    fontFamily: 'monospace',
                  }}>
                    {row.value >= 0 ? fmt(row.value) : `(${fmt(Math.abs(row.value))})`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trial Balance */}
      {tab === 'trial' && tb && (
        <div style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Code', 'Account', 'Type', 'Debits', 'Credits', 'Balance'].map(h => (
                  <th key={h} style={{
                    padding: '12px 16px', textAlign: 'left', fontSize: 11,
                    color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tb.accounts.map(acc => (
                <tr key={acc.code} style={{ borderBottom: '1px solid #1a2f48' }}>
                  <td style={{ padding: '10px 16px', fontSize: 12, color: '#4d6a87', fontFamily: 'monospace' }}>{acc.code}</td>
                  <td style={{ padding: '10px 16px', fontSize: 13, color: '#f0f6ff' }}>{acc.name}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      background: `${TYPE_COLORS[acc.accountType] ?? '#8ba8c7'}22`,
                      color: TYPE_COLORS[acc.accountType] ?? '#8ba8c7',
                      padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                    }}>
                      {acc.accountType}
                    </span>
                  </td>
                  <td style={{
                    padding: '10px 16px', fontSize: 13, fontFamily: 'monospace',
                    color: acc.debits > 0 ? '#f0f6ff' : '#4d6a87',
                  }}>{fmt(acc.debits)}</td>
                  <td style={{
                    padding: '10px 16px', fontSize: 13, fontFamily: 'monospace',
                    color: acc.credits > 0 ? '#f0f6ff' : '#4d6a87',
                  }}>{fmt(acc.credits)}</td>
                  <td style={{
                    padding: '10px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 600,
                    color: acc.balance > 0 ? '#22c55e' : acc.balance < 0 ? '#ef4444' : '#4d6a87',
                  }}>
                    {fmt(acc.balance)}
                  </td>
                </tr>
              ))}
              <tr style={{ background: '#1a2f48' }}>
                <td colSpan={3} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: '#8ba8c7' }}>TOTALS</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{fmt(tb.totalDebits)}</td>
                <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', fontWeight: 700 }}>{fmt(tb.totalCredits)}</td>
                <td style={{
                  padding: '12px 16px', fontSize: 13, fontWeight: 700,
                  color: tb.isBalanced ? '#22c55e' : '#ef4444',
                }}>
                  {tb.isBalanced ? '✓ Balanced' : '⚠ Imbalanced'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Transactions */}
      {tab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {txs.length === 0 ? (
            <div style={{
              background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12,
              padding: 48, textAlign: 'center', color: '#4d6a87',
            }}>
              No ledger transactions yet — auto-posted when orders are paid
            </div>
          ) : txs.map(tx => (
            <div key={tx.id} style={{ background: '#0b1526', border: '1px solid #1a2f48', borderRadius: 12, overflow: 'hidden' }}>
              <div
                onClick={() => setExpandedTx(expandedTx === tx.id ? null : tx.id)}
                style={{
                  padding: '14px 20px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f6ff' }}>{tx.description}</div>
                  <div style={{ fontSize: 11, color: '#4d6a87', marginTop: 2 }}>
                    {tx.referenceType} · {new Date(tx.postedAt).toLocaleString('pt-PT')}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#4da3ff', fontFamily: 'monospace' }}>
                    {fmt(tx.totalAmount, tx.currency)}
                  </span>
                  <span style={{ color: '#4d6a87', fontSize: 12 }}>
                    {expandedTx === tx.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>
              {expandedTx === tx.id && (
                <div style={{ borderTop: '1px solid #1a2f48' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Account', 'Type', 'Amount', 'Description'].map(h => (
                          <th key={h} style={{
                            padding: '8px 16px', textAlign: 'left', fontSize: 10,
                            color: '#4d6a87', borderBottom: '1px solid #1a2f48', fontWeight: 500,
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tx.entries.map(e => (
                        <tr key={e.id} style={{ borderBottom: '1px solid #1a2f48' }}>
                          <td style={{ padding: '8px 16px', fontSize: 12, color: '#4da3ff', fontFamily: 'monospace' }}>
                            {e.accountCode}
                          </td>
                          <td style={{ padding: '8px 16px' }}>
                            <span style={{
                              background: e.entryType === 'debit' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                              color: e.entryType === 'debit' ? '#ef4444' : '#22c55e',
                              padding: '1px 6px', borderRadius: 4, fontSize: 10,
                              fontWeight: 600, textTransform: 'uppercase',
                            }}>
                              {e.entryType}
                            </span>
                          </td>
                          <td style={{ padding: '8px 16px', fontSize: 12, fontFamily: 'monospace' }}>
                            {fmt(e.amount)}
                          </td>
                          <td style={{ padding: '8px 16px', fontSize: 12, color: '#8ba8c7' }}>
                            {e.description}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
