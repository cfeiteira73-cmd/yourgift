export default function ExecutiveLoading() {
  return (
    <div className="p-6 space-y-5">
      {/* Header with gauge */}
      <div className="flex justify-between items-start">
        <div className="flex gap-4 items-center">
          <div className="w-20 h-20 rounded-full bg-white/5 animate-pulse" />
          <div className="space-y-2">
            <div className="h-5 w-56 rounded-lg bg-white/5 animate-pulse" />
            <div className="h-3 w-36 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-28 rounded bg-white/5 animate-pulse" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-8 w-32 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-8 w-24 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </div>

      {/* AI Brief skeleton */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5 space-y-3">
        <div className="h-3 w-48 rounded bg-white/5 animate-pulse" />
        <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
        <div className="h-3 w-4/5 rounded bg-white/5 animate-pulse" />
        <div className="h-3 w-3/5 rounded bg-white/5 animate-pulse" />
      </div>

      {/* KPI rows */}
      {['💰 RECEITA', '🏭 PROCUREMENT', '🎯 QUALIDADE'].map((section, s) => (
        <div key={section} className="space-y-2">
          <div className="h-3 w-28 rounded bg-white/5 animate-pulse" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2"
                style={{ animationDelay: `${(s * 4 + i) * 60}ms` }}>
                <div className="h-7 w-20 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-16 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Insights grid */}
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
            <div className="h-4 w-36 rounded bg-white/5 animate-pulse" />
            {[...Array(2)].map((_, j) => (
              <div key={j} className="rounded-xl bg-white/3 border border-white/5 p-3 space-y-2">
                <div className="h-3 w-40 rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-full rounded bg-white/5 animate-pulse" />
                <div className="h-2.5 w-3/4 rounded bg-white/5 animate-pulse" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
