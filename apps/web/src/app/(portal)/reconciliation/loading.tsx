export default function ReconciliationLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-44 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-8 w-36 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-14 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-24 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-4 px-4 py-3 border-b border-white/3">
            <div className="h-3.5 w-24 rounded bg-white/5 animate-pulse" />
            <div className="h-3.5 w-16 rounded bg-white/5 animate-pulse" />
            <div className="h-3.5 w-20 rounded bg-white/5 animate-pulse flex-1" />
            <div className="h-5 w-16 rounded-full bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
