export type Lang = 'pt' | 'en';

export const translations = {
  pt: {
    nav: {
      home: 'Início',
      quote: 'Pedir Proposta',
      login: 'Entrar',
    },
    hero: {
      title: 'A plataforma de procurement corporativo',
      subtitle: 'Automatize os seus brindes e kits de empresa',
      cta: 'Solicitar Demo',
      secondary: 'Pedir Proposta',
    },
    quote: {
      title: 'Solicitar Proposta',
      submit: 'Enviar Pedido',
      success: 'Pedido recebido! Entraremos em contacto em 24-48 horas.',
    },
    store: {
      title: 'Loja',
      unavailable: 'Esta loja não está disponível de momento.',
      addToCart: 'Adicionar',
      comingSoon: 'Em breve',
    },
    common: {
      loading: 'A carregar...',
      error: 'Ocorreu um erro. Tente novamente.',
      back: 'Voltar',
      save: 'Guardar',
      cancel: 'Cancelar',
    },
  },
  en: {
    nav: {
      home: 'Home',
      quote: 'Request Quote',
      login: 'Sign In',
    },
    hero: {
      title: 'The corporate procurement platform',
      subtitle: 'Automate your company gifts and onboarding kits',
      cta: 'Request Demo',
      secondary: 'Get a Quote',
    },
    quote: {
      title: 'Request a Quote',
      submit: 'Submit Request',
      success: 'Request received! We will get back to you within 24-48 hours.',
    },
    store: {
      title: 'Store',
      unavailable: 'This store is not currently available.',
      addToCart: 'Add',
      comingSoon: 'Coming soon',
    },
    common: {
      loading: 'Loading...',
      error: 'An error occurred. Please try again.',
      back: 'Back',
      save: 'Save',
      cancel: 'Cancel',
    },
  },
} as const;

export type TranslationKeys = typeof translations.pt;

export function t(lang: Lang, key: string): string {
  const keys = key.split('.');
  let obj: unknown = translations[lang];
  for (const k of keys) {
    obj = (obj as Record<string, unknown>)?.[k];
    if (obj === undefined) return key;
  }
  return String(obj);
}

export function getLangFromCookie(cookieHeader?: string): Lang {
  const match = cookieHeader?.match(/lang=(pt|en)/);
  return (match?.[1] as Lang) ?? 'pt';
}
