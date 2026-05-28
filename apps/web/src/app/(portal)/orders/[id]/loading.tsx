export default function OrderDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="h-4 w-32 rounded bg-white/10" />
      </div>
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-48 rounded bg-white/10" />
          <div className="h-3 w-32 rounded bg-white/5" />
        </div>
        <div className="h-7 w-24 rounded-full bg-white/10" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-20 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center">
            <div className="h-3 w-48 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
