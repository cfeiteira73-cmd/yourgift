export default function SharedReportLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-56 rounded bg-white/10" />
          <div className="h-3 w-40 rounded bg-white/5" />
        </div>
        <div className="h-7 w-20 rounded-lg bg-white/10" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-20 rounded bg-white/10" />
            <div className="h-3 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/3 h-64" />
    </div>
  );
}
