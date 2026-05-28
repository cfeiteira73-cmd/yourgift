export default function SupplyChainLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="flex gap-4 items-center">
          <div className="w-20 h-20 rounded-full bg-white/5 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-3 w-28 rounded bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-5 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="h-6 w-12 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
            <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
            {[...Array(4)].map((_, j) => (
              <div key={j} className="rounded-xl bg-white/3 border border-white/5 p-3 space-y-2">
                <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
                <div className="h-2 w-full rounded-full bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
