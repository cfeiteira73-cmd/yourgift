'use client';
import { useRouter } from 'next/navigation';

interface Props {
  currentLang: 'pt' | 'en';
}

export function LanguageSwitcher({ currentLang }: Props) {
  const router = useRouter();

  const toggle = () => {
    const newLang = currentLang === 'pt' ? 'en' : 'pt';
    document.cookie = `lang=${newLang}; path=/; max-age=31536000; samesite=strict`;
    router.refresh();
  };

  return (
    <button
      onClick={toggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
      aria-label="Switch language"
    >
      <span>{currentLang === 'pt' ? '🇵🇹 PT' : '🇬🇧 EN'}</span>
    </button>
  );
}
