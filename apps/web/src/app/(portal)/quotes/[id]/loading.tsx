export default function QuoteDetailLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-4 w-4 rounded bg-white/10" />
        <div className="h-4 w-32 rounded bg-white/10" />
      </div>
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-52 rounded bg-white/10" />
          <div className="h-3 w-36 rounded bg-white/5" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-20 rounded-lg bg-white/5" />
          <div className="h-8 w-24 rounded-lg bg-white/10" />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-24 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
            <div className="h-3 flex-1 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/5" />
            <div className="h-3 w-12 rounded bg-white/5" />
            <div className="h-3 w-20 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </div>
  );
}
