export default function QuoteDecisionLoading() {
  return (
    <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-pulse">
      <div className="w-14 h-14 rounded-full bg-white/10" />
      <div className="text-center space-y-2">
        <div className="h-5 w-64 rounded bg-white/10 mx-auto" />
        <div className="h-3 w-48 rounded bg-white/5 mx-auto" />
      </div>
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6 w-full max-w-md space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between">
            <div className="h-3 w-28 rounded bg-white/10" />
            <div className="h-3 w-20 rounded bg-white/5" />
          </div>
        ))}
      </div>
      <div className="flex gap-3">
        <div className="h-10 w-28 rounded-lg bg-red-500/10" />
        <div className="h-10 w-28 rounded-lg bg-emerald-500/10" />
      </div>
    </div>
  );
}
