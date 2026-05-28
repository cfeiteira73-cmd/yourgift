export default function AssetsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-36 bg-white/10 rounded" />
          <div className="h-3 w-56 bg-white/5 rounded" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-white/5" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-2">
            <div className="h-5 w-10 bg-white/10 rounded" />
            <div className="h-2.5 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
            <div className="h-24 bg-white/8" />
            <div className="p-3 space-y-1.5">
              <div className="h-3 w-20 bg-white/10 rounded" />
              <div className="h-2 w-14 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
