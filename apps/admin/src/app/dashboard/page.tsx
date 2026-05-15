export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-8">Dashboard</h1>
      <div className="grid grid-cols-4 gap-6 mb-8">
        {[
          { label: 'Encomendas Hoje', value: '—' },
          { label: 'Receita Mes', value: '—' },
          { label: 'Em Producao', value: '—' },
          { label: 'Clientes Ativos', value: '—' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-gray-900 rounded-xl p-6 border border-gray-800">
            <p className="text-gray-400 text-sm mb-2">{kpi.label}</p>
            <p className="text-3xl font-bold text-white">{kpi.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
