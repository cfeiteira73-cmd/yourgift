export default function AuditLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-36 bg-white/10 rounded" />
          <div className="h-3 w-64 bg-white/5 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-lg bg-white/5" />
          <div className="h-7 w-20 rounded-lg bg-white/5" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-12 bg-white/10 rounded" />
            <div className="h-2.5 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="flex-1 h-8 rounded-lg bg-white/5" />
        <div className="flex-1 h-8 rounded-lg bg-white/5" />
        <div className="h-8 w-24 rounded-lg bg-white/5" />
      </div>
      <div className="rounded-2xl border border-white/8 overflow-hidden">
        <div className="h-8 bg-white/3 border-b border-white/5" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-10 border-b border-white/5 last:border-0 bg-white/1" />
        ))}
      </div>
    </div>
  );
}
