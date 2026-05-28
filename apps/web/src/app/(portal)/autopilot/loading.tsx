export default function AutopilotLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-36 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-52 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="h-9 w-40 rounded-lg bg-white/5 animate-pulse" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-10 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="h-4 w-28 rounded bg-white/5 animate-pulse" />
              <div className="h-5 w-14 rounded-full bg-white/5 animate-pulse" />
            </div>
            <div className="h-3 w-full rounded bg-white/5 animate-pulse" />
            <div className="h-8 w-full rounded-lg bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
