/**
 * Root-level loading UI — shown by Next.js App Router while
 * any RSC page in the root layout is streaming.
 */
export default function Loading() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm text-gray-400">A carregar…</span>
      </div>
    </div>
  );
}
