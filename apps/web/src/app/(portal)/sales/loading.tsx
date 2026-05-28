export default function SalesLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-6 w-52 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3.5 w-80 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>
      <div className="grid grid-cols-6 gap-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="h-6 w-14 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-40 rounded-lg bg-white/5 animate-pulse" />
        <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(9)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-3"
            style={{ animationDelay: `${i * 50}ms` }}>
            <div className="flex justify-between">
              <div className="space-y-1">
                <div className="h-3.5 w-36 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 animate-pulse" />
            <div className="grid grid-cols-4 gap-1">
              {[...Array(4)].map((_, j) => (
                <div key={j} className="rounded bg-white/5 animate-pulse h-8" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
