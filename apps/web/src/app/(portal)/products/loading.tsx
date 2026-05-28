export default function ProductsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-4 w-44 bg-white/10 rounded" />
          <div className="h-3 w-64 bg-white/5 rounded" />
        </div>
        <div className="h-8 w-28 rounded-lg bg-white/5" />
      </div>
      <div className="h-8 w-full rounded-lg bg-white/5" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
            <div className="h-32 bg-white/8" />
            <div className="p-3 space-y-2">
              <div className="h-3 w-24 bg-white/10 rounded" />
              <div className="h-2.5 w-16 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
