import type { Metadata } from "next";
import Link from "next/link";
import { constructMetadata } from "@/lib/seo";
import { AboutPageClient } from "./about-client";

export const metadata: Metadata = constructMetadata({
  title: "Sobre Nós — yourgift.pt",
  description:
    "Somos o parceiro de branding que as melhores empresas portuguesas escolhem. Fundada em 2020, 312 clientes activos, 20.000+ produtos, presença em 15+ países.",
  canonical: "/about",
});

export default function AboutPage() {
  return <AboutPageClient />;
}
