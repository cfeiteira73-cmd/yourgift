export default function IntelLoading() {
  return (
    <div className="p-6 space-y-5">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <div className="h-5 w-40 rounded-lg bg-white/5 animate-pulse" />
          <div className="h-3 w-56 rounded bg-white/5 animate-pulse" />
        </div>
        <div className="flex gap-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-8 w-28 rounded-lg bg-white/5 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-4 space-y-2">
            <div className="h-6 w-10 rounded bg-white/5 animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/3 p-3 space-y-2">
              <div className="flex justify-between">
                <div className="h-3.5 w-28 rounded bg-white/5 animate-pulse" />
                <div className="h-5 w-12 rounded-full bg-white/5 animate-pulse" />
              </div>
              <div className="h-1.5 w-full rounded-full bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/3 p-5 space-y-3">
          <div className="h-4 w-36 rounded bg-white/5 animate-pulse" />
          {[...Array(7)].map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-white/5 animate-pulse" />
              <div className="h-1.5 w-full rounded-full bg-white/5 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
