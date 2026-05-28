export default function AccountLoading() {
  return (
    <div className="p-6 space-y-6 max-w-2xl animate-pulse">
      <div className="h-5 w-24 rounded bg-white/10" />
      {/* Profile card */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/10 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-48 rounded bg-white/10" />
            <div className="h-3 w-32 rounded bg-white/5" />
          </div>
        </div>
      </div>
      {/* ID card */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-5 h-20" />
      {/* Security card */}
      <div className="rounded-2xl border border-white/5 bg-white/3 p-5 h-28" />
    </div>
  );
}
