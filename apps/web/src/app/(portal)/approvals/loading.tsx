export default function ApprovalsLoading() {
  return (
    <div className="p-6 space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-48 bg-white/10 rounded" />
        <div className="h-3 w-72 bg-white/5 rounded" />
      </div>
      <div className="grid grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-10 bg-white/10 rounded" />
            <div className="h-2.5 w-16 bg-white/5 rounded" />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 w-20 rounded-full bg-white/5" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-white/5 border border-white/5" />
        ))}
      </div>
    </div>
  );
}
