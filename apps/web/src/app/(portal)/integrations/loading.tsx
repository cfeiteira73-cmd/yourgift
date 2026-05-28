export default function IntegrationsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-40 bg-white/10 rounded" />
        <div className="h-3 w-60 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  );
}
