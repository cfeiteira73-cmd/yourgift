'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fadeUp, springSnappy } from '@/lib/motion';

// ── OMEGA X — S4+S8+S12: Infrastructure Command Center ───────────────────────

type FleetSummary = {
  total: number; online: number; offline: number; error: number; maintenance: number;
  health_pct: number; by_type: Record<string, number>;
};

type InfraSummary = {
  total: number; healthy: number; degraded: number; unhealthy: number;
  overall_health: number; critical_services: string[];
};

type ERPStatus = {
  total: number; enabled: number; healthy: number; errors: number;
  connectors: Array<{ id: string; name: string; connector_type: string; enabled: boolean; sync_status: string; last_sync: string | null; error_message: string | null }>;
};

type Device = {
  id: string; device_id: string; device_type: string; label: string;
  location: string | null; status: string; last_ping: string | null; firmware_version: string | null;
};

type Probe = {
  id: string; service_name: string; probe_type: string; status: string;
  consecutive_failures: number; threshold_fail: number;
  last_check: string | null; last_success: string | null; remediation: string | null;
};

type ERPConnector = {
  id: string; name: string; connector_type: string; enabled: boolean;
  auth_type: string; sync_status: string; last_sync: string | null; error_message: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  online: 'text-emerald-400', healthy: 'text-emerald-400',
  offline: 'text-white/30', idle: 'text-white/40',
  error: 'text-red-400', unhealthy: 'text-red-400',
  maintenance: 'text-amber-400', degraded: 'text-amber-400',
  syncing: 'text-blue-400', success: 'text-emerald-400',
  unknown: 'text-white/30',
};

const STATUS_DOT: Record<string, string> = {
  online: 'bg-emerald-400', healthy: 'bg-emerald-400',
  offline: 'bg-white/20', idle: 'bg-white/20',
  error: 'bg-red-400', unhealthy: 'bg-red-400',
  maintenance: 'bg-amber-400', degraded: 'bg-amber-400',
  syncing: 'bg-blue-400 animate-pulse', success: 'bg-emerald-400',
  unknown: 'bg-white/20',
};

function HealthBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const color = pct >= 90 ? 'bg-emerald-500' : pct >= 70 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className={`bg-white/5 rounded-full w-full ${size === 'sm' ? 'h-1' : 'h-1.5'}`}>
      <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function InfraPage() {
  const [tab, setTab] = useState<'iot' | 'erp' | 'health'>('health');
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  const [infraHealth, setInfraHealth] = useState<InfraSummary | null>(null);
  const [erpStatus, setErpStatus] = useState<ERPStatus | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [probes, setProbes] = useState<Probe[]>([]);
  const [connectors, setConnectors] = useState<ERPConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  // IoT forms
  const [showRegister, setShowRegister] = useState(false);
  const [regForm, setRegForm] = useState({ device_id: '', device_type: 'printer', label: '', location: '' });
  const [creating, setCreating] = useState(false);

  // ERP form
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [connForm, setConnForm] = useState({ name: '', connector_type: 'sap', endpoint_url: '', auth_type: 'api_key' });

  // Health probe form
  const [showAddProbe, setShowAddProbe] = useState(false);
  const [probeForm, setProbeForm] = useState({ service_name: '', probe_type: 'http', endpoint: '', threshold_fail: '3' });

  const loadAll = useCallback(async () => {
    const [fleetRes, infraRes, erpRes] = await Promise.all([
      fetch('/api/iot?mode=fleet'),
      fetch('/api/health-probes?mode=summary'),
      fetch('/api/erp?mode=status'),
    ]);
    if (fleetRes.ok) setFleet(await fleetRes.json());
    if (infraRes.ok) setInfraHealth(await infraRes.json());
    if (erpRes.ok) setErpStatus(await erpRes.json());
  }, []);

  const loadTabData = useCallback(async () => {
    if (tab === 'iot') {
      const res = await fetch('/api/iot?mode=devices');
      if (res.ok) { const d = await res.json(); setDevices(d.devices ?? []); }
    } else if (tab === 'health') {
      const res = await fetch('/api/health-probes?mode=probes');
      if (res.ok) { const d = await res.json(); setProbes(d.probes ?? []); }
    } else if (tab === 'erp') {
      const res = await fetch('/api/erp?mode=connectors');
      if (res.ok) { const d = await res.json(); setConnectors(d.connectors ?? []); }
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  useEffect(() => { loadTabData(); }, [loadTabData]);

  async function registerDevice() {
    if (!regForm.device_id || !regForm.label) return;
    setCreating(true);
    try {
      await fetch('/api/iot', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'register', ...regForm }),
      });
      setShowRegister(false);
      setRegForm({ device_id: '', device_type: 'printer', label: '', location: '' });
      await loadTabData();
    } finally { setCreating(false); }
  }

  async function triggerSync(connId: string) {
    setSyncing(connId);
    try {
      await fetch('/api/erp', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'trigger_sync', id: connId }),
      });
      await loadTabData();
    } finally { setSyncing(null); }
  }

  async function testConnector(connId: string) {
    setTesting(connId);
    try {
      await fetch('/api/erp', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'test', id: connId }),
      });
    } finally { setTesting(null); }
  }

  async function addConnector() {
    if (!connForm.name || !connForm.connector_type) return;
    setCreating(true);
    try {
      await fetch('/api/erp', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create', ...connForm }),
      });
      setShowAddConnector(false);
      setConnForm({ name: '', connector_type: 'sap', endpoint_url: '', auth_type: 'api_key' });
      await loadTabData();
    } finally { setCreating(false); }
  }

  async function addProbe() {
    if (!probeForm.service_name || !probeForm.probe_type) return;
    setCreating(true);
    try {
      await fetch('/api/health-probes', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'create_probe', ...probeForm, threshold_fail: Number(probeForm.threshold_fail) }),
      });
      setShowAddProbe(false);
      setProbeForm({ service_name: '', probe_type: 'http', endpoint: '', threshold_fail: '3' });
      await loadTabData();
    } finally { setCreating(false); }
  }

  async function resetProbe(probeId: string) {
    await fetch('/api/health-probes', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'reset', id: probeId }),
    });
    await loadTabData();
  }

  if (loading) return null;

  const overallScore = Math.round(
    ((fleet?.health_pct ?? 100) * 0.3 + (infraHealth?.overall_health ?? 100) * 0.5 + ((erpStatus && erpStatus.total > 0 ? ((erpStatus.healthy / erpStatus.total) * 100) : 100)) * 0.2)
  );

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-lg font-semibold text-white">Infraestrutura</h1>
          <p className="text-xs text-white/40 mt-0.5">
            Score geral: <span className={overallScore >= 90 ? 'text-emerald-400' : overallScore >= 70 ? 'text-amber-400' : 'text-red-400'}>
              {overallScore}/100
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          {(['health', 'iot', 'erp'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                tab === t ? 'bg-white/10 border-white/20 text-white' : 'border-white/5 text-white/40 hover:text-white/70'}`}>
              {t === 'health' ? '🛡 Saúde' : t === 'iot' ? '📡 IoT' : '🔌 ERP/EDI'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { l: 'Infra Health', v: `${infraHealth?.overall_health ?? '—'}%`,
            color: (infraHealth?.overall_health ?? 100) >= 90 ? 'text-emerald-400' : 'text-amber-400' },
          { l: 'IoT Online', v: `${fleet?.online ?? 0}/${fleet?.total ?? 0}`,
            color: (fleet?.health_pct ?? 100) >= 80 ? 'text-emerald-400' : 'text-red-400' },
          { l: 'ERP Conectores', v: `${erpStatus?.enabled ?? 0}/${erpStatus?.total ?? 0}`,
            color: 'text-blue-300' },
          { l: 'Alertas críticos', v: infraHealth?.critical_services?.length ?? 0,
            color: (infraHealth?.critical_services?.length ?? 0) > 0 ? 'text-red-400' : 'text-emerald-400' },
        ].map((k, i) => (
          <motion.div key={i} {...fadeUp} transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-white/5 bg-white/3 p-4">
            <p className={`text-2xl font-bold ${k.color}`}>{k.v}</p>
            <p className="text-xs text-white/40 mt-1">{k.l}</p>
          </motion.div>
        ))}
      </div>

      {/* Health Probes tab */}
      {tab === 'health' && (
        <motion.div {...fadeUp} className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddProbe(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30 transition-colors">
              + Adicionar Probe
            </button>
          </div>

          {infraHealth?.critical_services && infraHealth.critical_services.length > 0 && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 flex items-center gap-2">
              <span className="text-red-400">⚠</span>
              <p className="text-xs text-red-300">Serviços críticos: {infraHealth.critical_services.join(', ')}</p>
            </div>
          )}

          {probes.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">🛡</p>
              <p className="text-sm text-white/50">Nenhum probe configurado</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {probes.map((probe, i) => (
                <motion.div key={probe.id} {...fadeUp} transition={{ delay: i * 0.04 }}
                  className={`rounded-2xl border p-4 ${
                    probe.status === 'unhealthy' ? 'border-red-500/30 bg-red-500/5'
                    : probe.status === 'degraded' ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-white/5 bg-white/3'}`}>
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[probe.status] ?? 'bg-white/20'}`} />
                        <p className="text-sm font-semibold text-white/90">{probe.service_name}</p>
                      </div>
                      <p className="text-xs text-white/35 mt-0.5 ml-4">{probe.probe_type.toUpperCase()}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${STATUS_COLOR[probe.status] ?? 'text-white/40'}`}>
                        {probe.status}
                      </span>
                      {probe.status !== 'healthy' && (
                        <button onClick={() => resetProbe(probe.id)}
                          className="text-xs text-white/30 hover:text-white/60 border border-white/10 rounded px-1.5 py-0.5 transition-colors">
                          reset
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-4 text-xs text-white/40">
                    <span>{probe.consecutive_failures}/{probe.threshold_fail} falhas</span>
                    {probe.last_check && (
                      <span>Último check: {new Date(probe.last_check).toLocaleTimeString('pt-PT')}</span>
                    )}
                  </div>
                  {probe.consecutive_failures > 0 && (
                    <div className="mt-2">
                      <HealthBar pct={Math.max(0, 100 - (probe.consecutive_failures / probe.threshold_fail) * 100)} size="sm" />
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* IoT tab */}
      {tab === 'iot' && (
        <motion.div {...fadeUp} className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowRegister(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 transition-colors">
              + Registar Dispositivo
            </button>
          </div>

          {/* Fleet summary */}
          {fleet && (
            <div className="rounded-xl border border-white/5 bg-white/3 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-white/50">Fleet Health</p>
                <span className="text-xs font-semibold text-emerald-300">{fleet.health_pct}%</span>
              </div>
              <HealthBar pct={fleet.health_pct} />
              <div className="flex gap-4 mt-2 text-xs text-white/40">
                <span>✓ {fleet.online} online</span>
                <span>○ {fleet.offline} offline</span>
                {fleet.error > 0 && <span className="text-red-400">⚠ {fleet.error} erros</span>}
                {fleet.maintenance > 0 && <span className="text-amber-400">🔧 {fleet.maintenance} manutenção</span>}
              </div>
            </div>
          )}

          {devices.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">📡</p>
              <p className="text-sm text-white/50">Nenhum dispositivo IoT registado</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {devices.map((d, i) => (
                <motion.div key={d.id} {...fadeUp} transition={{ delay: i * 0.04 }}
                  className="rounded-xl border border-white/5 bg-white/3 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white/80">{d.label}</p>
                      <p className="text-xs text-white/35 font-mono mt-0.5">{d.device_id}</p>
                    </div>
                    <span className={`w-2 h-2 rounded-full shrink-0 mt-1 ${STATUS_DOT[d.status] ?? 'bg-white/20'}`} />
                  </div>
                  <div className="flex gap-3 text-xs text-white/40">
                    <span className="capitalize">{d.device_type}</span>
                    {d.location && <span>{d.location}</span>}
                  </div>
                  {d.last_ping && (
                    <p className="text-xs text-white/25 mt-1">
                      Ping: {new Date(d.last_ping).toLocaleTimeString('pt-PT')}
                    </p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* ERP tab */}
      {tab === 'erp' && (
        <motion.div {...fadeUp} className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowAddConnector(true)}
              className="px-3 py-1.5 text-xs rounded-lg bg-violet-500/20 border border-violet-500/30 text-violet-300 hover:bg-violet-500/30 transition-colors">
              + Adicionar Conector
            </button>
          </div>

          {connectors.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/3 p-16 text-center">
              <p className="text-3xl mb-3">🔌</p>
              <p className="text-sm text-white/50">Nenhum conector ERP/EDI configurado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {connectors.map((conn, i) => (
                <motion.div key={conn.id} {...fadeUp} transition={{ delay: i * 0.04 }}
                  className={`rounded-2xl border p-4 ${conn.sync_status === 'error' ? 'border-red-500/20' : 'border-white/5'} bg-white/3`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[conn.sync_status] ?? 'bg-white/20'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white/90">{conn.name}</p>
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-white/40 uppercase">{conn.connector_type}</span>
                        {!conn.enabled && <span className="text-xs text-white/25">desativado</span>}
                      </div>
                      <div className="flex gap-3 text-xs text-white/35 mt-0.5">
                        <span className={STATUS_COLOR[conn.sync_status] ?? 'text-white/40'}>{conn.sync_status}</span>
                        {conn.last_sync && <span>Último: {new Date(conn.last_sync).toLocaleString('pt-PT')}</span>}
                        {conn.error_message && <span className="text-red-400 truncate">{conn.error_message}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => testConnector(conn.id)} disabled={testing === conn.id}
                        className="text-xs border border-white/10 rounded px-2 py-1 text-white/40 hover:text-white/60 transition-colors disabled:opacity-40">
                        {testing === conn.id ? '…' : 'Testar'}
                      </button>
                      <button onClick={() => triggerSync(conn.id)} disabled={syncing === conn.id || !conn.enabled}
                        className="text-xs border border-blue-500/30 rounded px-2 py-1 text-blue-300 hover:bg-blue-500/10 transition-colors disabled:opacity-40">
                        {syncing === conn.id ? 'Sync…' : 'Sync'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* IoT Register Modal */}
      <AnimatePresence>
        {showRegister && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowRegister(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={springSnappy}
              className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-3">
              <h2 className="text-sm font-semibold text-white">Registar Dispositivo IoT</h2>
              <input value={regForm.device_id} onChange={e => setRegForm(p => ({ ...p, device_id: e.target.value }))}
                placeholder="Device ID (único) *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none font-mono" />
              <input value={regForm.label} onChange={e => setRegForm(p => ({ ...p, label: e.target.value }))}
                placeholder="Label *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <select value={regForm.device_type} onChange={e => setRegForm(p => ({ ...p, device_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none">
                {['printer','scanner','scale','conveyor','camera','sensor','robot','custom'].map(t => (
                  <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>
                ))}
              </select>
              <input value={regForm.location} onChange={e => setRegForm(p => ({ ...p, location: e.target.value }))}
                placeholder="Localização" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowRegister(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm">Cancelar</button>
                <button onClick={registerDevice} disabled={!regForm.device_id || !regForm.label || creating}
                  className="flex-1 py-2 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-medium disabled:opacity-40">
                  {creating ? 'A registar…' : 'Registar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ERP Connector Modal */}
      <AnimatePresence>
        {showAddConnector && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowAddConnector(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={springSnappy}
              className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-3">
              <h2 className="text-sm font-semibold text-white">Adicionar Conector ERP/EDI</h2>
              <input value={connForm.name} onChange={e => setConnForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Nome *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <select value={connForm.connector_type} onChange={e => setConnForm(p => ({ ...p, connector_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none">
                {['sap','oracle','netsuite','odoo','xero','primavera','sage','custom_api','edi_x12','edi_edifact'].map(t => (
                  <option key={t} value={t} className="bg-[#1a1a1a] uppercase">{t}</option>
                ))}
              </select>
              <input value={connForm.endpoint_url} onChange={e => setConnForm(p => ({ ...p, endpoint_url: e.target.value }))}
                placeholder="Endpoint URL" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddConnector(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm">Cancelar</button>
                <button onClick={addConnector} disabled={!connForm.name || creating}
                  className="flex-1 py-2 rounded-xl bg-violet-500/20 border border-violet-500/30 text-violet-300 text-sm font-medium disabled:opacity-40">
                  {creating ? 'A criar…' : 'Criar'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Health Probe Modal */}
      <AnimatePresence>
        {showAddProbe && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setShowAddProbe(false); }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }} transition={springSnappy}
              className="bg-[#0f0f0f] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-3">
              <h2 className="text-sm font-semibold text-white">Adicionar Health Probe</h2>
              <input value={probeForm.service_name} onChange={e => setProbeForm(p => ({ ...p, service_name: e.target.value }))}
                placeholder="Nome do serviço *" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <select value={probeForm.probe_type} onChange={e => setProbeForm(p => ({ ...p, probe_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 outline-none">
                {['http','db','queue','cache','custom'].map(t => (
                  <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>
                ))}
              </select>
              <input value={probeForm.endpoint} onChange={e => setProbeForm(p => ({ ...p, endpoint: e.target.value }))}
                placeholder="Endpoint / URL" className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white/80 placeholder:text-white/20 outline-none" />
              <div>
                <label className="text-xs text-white/30 mb-1 block">Falhas até alerta: {probeForm.threshold_fail}</label>
                <input type="range" min="1" max="10" value={probeForm.threshold_fail}
                  onChange={e => setProbeForm(p => ({ ...p, threshold_fail: e.target.value }))}
                  className="w-full accent-emerald-400 cursor-pointer" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddProbe(false)} className="flex-1 py-2 rounded-xl border border-white/10 text-white/50 text-sm">Cancelar</button>
                <button onClick={addProbe} disabled={!probeForm.service_name || creating}
                  className="flex-1 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-sm font-medium disabled:opacity-40">
                  {creating ? 'A criar…' : 'Criar Probe'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
