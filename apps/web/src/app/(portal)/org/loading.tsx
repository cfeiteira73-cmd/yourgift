export default function OrgLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-48 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-64 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="h-6 w-10 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
            <div className="flex justify-between">
              <div className="space-y-1">
                <div className="h-4 w-32 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
              </div>
              <div className="h-5 w-14 rounded bg-white/5 animate-pulse" />
            </div>
            {[...Array(3)].map((_, j) => (
              <div key={j} className="flex justify-between">
                <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
