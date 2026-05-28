export default function ProductDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="h-4 w-28 rounded bg-white/10" />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/5 bg-white/3 aspect-square" />
        <div className="space-y-4">
          <div className="h-6 w-3/4 rounded bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/5" />
          <div className="h-8 w-28 rounded bg-white/10" />
          <div className="space-y-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <div className="h-3 w-24 rounded bg-white/10" />
                <div className="h-3 w-20 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
