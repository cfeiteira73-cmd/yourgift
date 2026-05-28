export default function ClientSuccessLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-white/10 rounded" />
          <div className="h-3 w-56 bg-white/5 rounded" />
        </div>
        <div className="h-8 w-32 bg-white/10 rounded-lg" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-10 bg-white/10 rounded" />
            <div className="h-3 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-24 bg-white/10 rounded" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-16 rounded-xl bg-white/5 border border-white/5" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
