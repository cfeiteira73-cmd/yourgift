export default function InventoryLoading() {
  return (
    <div className="flex h-full gap-0">
      {/* Left panel */}
      <div className="w-80 shrink-0 flex flex-col gap-3 p-4 border-r border-white/5">
        <div className="flex items-center justify-between">
          <div className="h-5 w-28 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-7 w-12 rounded-lg bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="h-8 w-full rounded-xl bg-white/5 animate-pulse" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-6 w-14 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
        {[...Array(7)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-2"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex justify-between">
              <div className="space-y-1">
                <div className="h-3.5 w-36 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="h-1 w-full rounded-full bg-white/5 animate-pulse" />
            <div className="flex justify-between">
              <div className="h-2.5 w-12 rounded bg-white/5 animate-pulse" />
              <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div className="flex-1 p-6 space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2"
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className="h-6 w-16 rounded bg-white/5 animate-pulse" />
              <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex justify-between items-center py-2 border-b border-white/5">
                  <div className="h-3 w-28 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
