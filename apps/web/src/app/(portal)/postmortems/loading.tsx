export default function PostmortemsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-white/10 rounded" />
          <div className="h-3 w-56 bg-white/5 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-28 bg-white/10 rounded-lg" />
          <div className="h-8 w-36 bg-white/10 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-10 bg-white/10 rounded" />
            <div className="h-3 w-20 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-5">
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 rounded-xl bg-white/5 border border-white/5" />
          ))}
        </div>
        <div className="col-span-2 h-80 rounded-2xl bg-white/5 border border-white/5" />
      </div>
    </div>
  );
}
