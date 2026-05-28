export default function ReportsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-48 bg-white/10 rounded" />
        <div className="h-3 w-64 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-white/5 border border-white/5" />
        ))}
      </div>
      <div className="h-64 rounded-2xl bg-white/5 border border-white/5" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  );
}
