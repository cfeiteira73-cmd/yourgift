export default function MarketplaceLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="h-9 w-full rounded-lg bg-white/5 animate-pulse" />
      <div className="grid grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-4 space-y-3"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex justify-between">
              <div className="h-3.5 w-20 rounded bg-white/5 animate-pulse" />
              <div className="h-5 w-12 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="h-4 w-full rounded bg-white/5 animate-pulse" />
            <div className="h-3 w-3/4 rounded bg-white/5 animate-pulse" />
            <div className="flex gap-2 pt-1">
              <div className="h-6 w-16 rounded-full bg-white/5 animate-pulse" />
              <div className="h-6 w-14 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="flex justify-between pt-1">
              <div className="h-5 w-16 rounded bg-white/5 animate-pulse" />
              <div className="h-7 w-20 rounded-lg bg-white/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
