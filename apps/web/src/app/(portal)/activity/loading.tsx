export default function ActivityLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {[...Array(10)].map((_, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-xl border border-white/5 bg-white/3"
            style={{ animationDelay: `${i * 40}ms` }}>
            <div className="w-7 h-7 rounded-full bg-white/5 animate-pulse shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-3/4 rounded bg-white/5 animate-pulse" />
              <div className="h-2.5 w-1/2 rounded bg-white/5 animate-pulse" />
            </div>
            <div className="h-3 w-12 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
