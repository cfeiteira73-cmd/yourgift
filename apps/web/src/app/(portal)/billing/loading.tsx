export default function BillingLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-36 bg-white/10 rounded" />
        <div className="h-3 w-60 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-16 bg-white/10 rounded" />
            <div className="h-2.5 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-64 rounded-2xl bg-white/5 border border-white/5" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-11 rounded-xl bg-white/5 border border-white/5" />
          ))}
        </div>
      </div>
    </div>
  );
}
