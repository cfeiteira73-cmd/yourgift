export default function NewQuoteLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse max-w-2xl mx-auto">
      <div className="h-5 w-36 rounded bg-white/10" />
      <div className="rounded-2xl border border-white/5 bg-white/3 p-6 space-y-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-20 rounded bg-white/10" />
            <div className="h-9 w-full rounded-lg bg-white/5" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <div className="h-9 w-20 rounded-lg bg-white/5" />
          <div className="h-9 w-28 rounded-lg bg-white/10" />
        </div>
      </div>
    </div>
  );
}
