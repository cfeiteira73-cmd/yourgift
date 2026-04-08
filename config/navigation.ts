export type NavItem = {
  label: string;
  href: string;
  description?: string;
  children?: NavItem[];
};

export const mainNav: NavItem[] = [
  {
    label: "Soluções",
    href: "/services",
    children: [
      {
        label: "Corporate Gifts",
        href: "/corporate-gifts",
        description: "Presentes premium para clientes e parceiros",
      },
      {
        label: "Branded Merchandise",
        href: "/branded-merch",
        description: "Merch de marca com qualidade internacional",
      },
      {
        label: "Packaging Premium",
        href: "/packaging",
        description: "Embalagens personalizadas que comunicam a marca",
      },
      {
        label: "Company Stores",
        href: "/company-stores",
        description: "Lojas privadas para equipas e departamentos",
      },
      {
        label: "Fulfillment",
        href: "/fulfillment",
        description: "Produção, armazenagem e envio completo",
      },
    ],
  },
  {
    label: "Catálogo",
    href: "/catalog",
  },
  {
    label: "Como Funciona",
    href: "/how-it-works",
  },
  {
    label: "Sobre",
    href: "/about",
  },
  {
    label: "Blog",
    href: "/blog",
  },
];

export const footerNav = {
  solutions: [
    { label: "Corporate Gifts", href: "/corporate-gifts" },
    { label: "Branded Merch", href: "/branded-merch" },
    { label: "Packaging", href: "/packaging" },
    { label: "Company Stores", href: "/company-stores" },
    { label: "Fulfillment", href: "/fulfillment" },
  ],
  company: [
    { label: "Sobre nós", href: "/about" },
    { label: "Como Funciona", href: "/how-it-works" },
    { label: "Blog", href: "/blog" },
    { label: "Contacto", href: "/contact" },
    { label: "FAQ", href: "/faq" },
  ],
  legal: [
    { label: "Política de Privacidade", href: "/privacy-policy" },
    { label: "Termos de Serviço", href: "/terms" },
  ],
};
