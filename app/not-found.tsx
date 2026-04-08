import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[rgb(7,17,31)]">
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 30%, rgba(77,163,255,0.18), transparent)",
        }}
      />
      <div className="relative text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4DA3FF] to-[#63E6BE] mb-6">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <h1 className="text-7xl font-bold text-white mb-4">404</h1>
        <h2 className="text-xl font-semibold text-white mb-3">Página não encontrada</h2>
        <p className="text-white/50 mb-8">
          A página que procuras não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-white text-[#07111F] px-6 py-3 rounded-xl font-semibold text-sm hover:bg-white/90 transition-all"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
