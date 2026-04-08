import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import { ContactForm } from "@/components/shared/contact-form";
import { Mail, Phone, MapPin, Clock } from "lucide-react";

export const metadata: Metadata = constructMetadata({
  title: "Contacto",
  description: "Fala connosco. Estamos disponíveis para responder a todas as tuas questões sobre corporate gifts, branded merchandise e company stores.",
});

export default function ContactPage() {
  return (
    <div className="min-h-screen pt-28 pb-20">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        <div className="max-w-xl mb-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#4DA3FF] mb-3">Contacto</p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-white mb-4">
            Fala connosco.
          </h1>
          <p className="text-white/56 text-lg">
            Temos uma equipa pronta para te ajudar com qualquer questão sobre o teu projeto.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <ContactForm />
          </div>
          <div className="space-y-6">
            {[
              { icon: <Mail className="h-5 w-5" />, label: "Email", value: "hello@yourgift.pt", href: "mailto:hello@yourgift.pt" },
              { icon: <Phone className="h-5 w-5" />, label: "Telefone", value: "+351 210 000 000", href: "tel:+351210000000" },
              { icon: <MapPin className="h-5 w-5" />, label: "Localização", value: "Lisboa, Portugal", href: undefined },
              { icon: <Clock className="h-5 w-5" />, label: "Horário", value: "Segunda–Sexta, 9h–18h", href: undefined },
            ].map((item) => (
              <div key={item.label} className="flex items-start gap-4 p-5 rounded-2xl border border-white/[0.07] bg-white/[0.03]">
                <div className="p-2.5 rounded-xl bg-[#4DA3FF]/12 text-[#4DA3FF] flex-shrink-0">{item.icon}</div>
                <div>
                  <div className="text-xs text-white/38 mb-1">{item.label}</div>
                  {item.href ? (
                    <a href={item.href} className="text-sm font-medium text-white/80 hover:text-white transition-colors">{item.value}</a>
                  ) : (
                    <div className="text-sm font-medium text-white/80">{item.value}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
