export default function QCLoading() {
  return (
    <div className="flex h-full gap-0">
      {/* Left panel */}
      <div className="w-75 shrink-0 flex flex-col gap-3 p-4 border-r border-white/5" style={{ width: '300px' }}>
        <div className="flex items-center justify-between">
          <div className="h-5 w-32 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex gap-2">
            <div className="h-7 w-16 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-7 w-12 rounded-lg bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-1 flex-wrap">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-5 w-14 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-2"
            style={{ animationDelay: `${i * 70}ms` }}>
            <div className="flex justify-between">
              <div className="space-y-1">
                <div className="h-3.5 w-32 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="space-y-1 items-end flex flex-col">
                <div className="h-4 w-14 rounded-full bg-white/5 animate-pulse" />
                <div className="h-3 w-10 rounded bg-white/5 animate-pulse" />
              </div>
            </div>
            <div className="h-2.5 w-40 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>

      {/* Right panel */}
      <div className="flex-1 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <div className="h-6 w-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="flex gap-3">
            <div className="h-10 w-10 rounded-full bg-white/5 animate-pulse" />
            <div className="h-6 w-20 rounded-full bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
              <div className="h-6 w-10 rounded bg-white/5 animate-pulse" />
              <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
              <div className="h-4 w-36 rounded bg-white/5 animate-pulse" />
              <div className="h-9 rounded-xl bg-white/5 animate-pulse" />
              {[...Array(3)].map((_, j) => (
                <div key={j} className="rounded-xl bg-white/3 border border-white/5 p-3 space-y-1">
                  <div className="flex justify-between">
                    <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                    <div className="h-3 w-14 rounded bg-white/5 animate-pulse" />
                  </div>
                  <div className="h-2.5 w-36 rounded bg-white/5 animate-pulse" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
