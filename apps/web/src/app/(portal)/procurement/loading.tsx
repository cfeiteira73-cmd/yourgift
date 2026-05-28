export default function ProcurementLoading() {
  return (
    <div className="flex h-full gap-6 p-6">
      {/* Left panel skeleton */}
      <div className="w-80 shrink-0 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="h-6 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
        </div>
        {/* Filter tabs */}
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-7 w-16 rounded-full bg-white/5 animate-pulse" />
          ))}
        </div>
        {/* RFQ list */}
        <div className="flex flex-col gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2"
              style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-40 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
              </div>
              <div className="flex gap-3">
                <div className="h-3 w-20 rounded bg-white/5 animate-pulse" />
                <div className="h-3 w-16 rounded bg-white/5 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel skeleton */}
      <div className="flex-1 rounded-2xl border border-white/5 bg-white/3 p-8 flex flex-col items-center justify-center gap-6">
        {/* Mode tabs */}
        <div className="flex gap-3 self-start">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg bg-white/5 animate-pulse"
              style={{ animationDelay: `${i * 60}ms` }} />
          ))}
        </div>
        {/* Content area */}
        <div className="w-full space-y-6 mt-4">
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-5 space-y-3"
                style={{ animationDelay: `${i * 100}ms` }}>
                <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
                <div className="h-7 w-16 rounded bg-white/5 animate-pulse" />
                <div className="h-2 w-full rounded-full bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-white/5 bg-white/3 p-6 space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-4"
                style={{ animationDelay: `${i * 80}ms` }}>
                <div className="h-10 w-10 rounded-full bg-white/5 animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-48 rounded bg-white/5 animate-pulse" />
                  <div className="h-3 w-32 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
