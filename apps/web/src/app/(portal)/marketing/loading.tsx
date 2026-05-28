export default function MarketingLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-44 bg-white/10 rounded" />
          <div className="h-3 w-64 bg-white/5 rounded" />
        </div>
        <div className="h-8 w-36 rounded-lg bg-white/5" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-14 bg-white/10 rounded" />
            <div className="h-2.5 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-56 rounded-2xl bg-white/5 border border-white/5" />
        <div className="h-56 rounded-2xl bg-white/5 border border-white/5" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  );
}
