export default function FlagsLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-4 space-y-3"
            style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex justify-between items-start">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-white/10 animate-pulse" />
                  <div className="h-3.5 w-40 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="h-2.5 w-32 rounded bg-white/5 animate-pulse ml-4" />
              </div>
              <div className="w-10 h-5 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
