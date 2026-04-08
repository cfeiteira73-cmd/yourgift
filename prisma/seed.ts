import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Seed products
  const products = [
    {
      slug: "premium-leather-journal",
      name: "Premium Leather Journal",
      shortDescription: "Diário em pele genuína para gifting premium",
      description: "Diário premium em pele genuína, ideal para corporate gifts e welcome kits. Personalização por debossing ou gravação laser.",
      category: "corporate-gifts",
      images: ["https://images.unsplash.com/photo-1544816155-12df9643f363?w=800&h=800&fit=crop"],
      moq: 50,
      leadTimeDays: 12,
      priceFrom: 12.0,
      featured: true,
      popular: true,
      tags: ["leather", "journal", "corporate", "premium"],
    },
    {
      slug: "insulated-tumbler-500ml",
      name: "Insulated Tumbler 500ml",
      shortDescription: "Tumbler isotérmico premium para branding",
      description: "Tumbler 500ml de aço inoxidável com isolamento dupla parede. Mantém bebidas quentes 12h e frias 24h.",
      category: "drinkware",
      images: ["https://images.unsplash.com/photo-1616345840969-851d7e671c74?w=800&h=800&fit=crop"],
      moq: 100,
      leadTimeDays: 10,
      priceFrom: 18.0,
      sustainable: true,
      popular: true,
      tags: ["tumbler", "drinkware", "sustainable"],
    },
    {
      slug: "organic-cotton-tee",
      name: "Organic Cotton Tee",
      shortDescription: "T-shirt 100% algodão orgânico certificado",
      description: "T-shirt em algodão orgânico certificado GOTS. Disponível em múltiplas cores e tamanhos XS-3XL.",
      category: "apparel",
      images: ["https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&h=800&fit=crop"],
      moq: 50,
      leadTimeDays: 10,
      priceFrom: 9.0,
      sustainable: true,
      tags: ["apparel", "organic", "tshirt"],
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
    console.log(`✓ Product: ${product.name}`);
  }

  // Seed blog posts
  await prisma.blogPost.upsert({
    where: { slug: "guia-corporate-gifts-2025" },
    update: {},
    create: {
      slug: "guia-corporate-gifts-2025",
      title: "Guia completo de Corporate Gifts para 2025",
      excerpt: "Tendências, estratégias e os produtos mais procurados por empresas para presentes corporativos este ano.",
      content: "Conteúdo completo do artigo...",
      category: "Corporate Gifts",
      published: true,
      publishedAt: new Date("2025-01-15"),
    },
  });

  console.log("✅ Seed complete!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
