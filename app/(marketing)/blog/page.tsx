import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo";
import { BlogClientPage } from "./blog-client";

export const metadata: Metadata = constructMetadata({
  title: "Blog — Insights & Tendências",
  description:
    "Artigos e guias sobre corporate gifting, branded merchandise, company stores e tendências de branding B2B.",
  canonical: "/blog",
});

export default function BlogPage() {
  return <BlogClientPage />;
}
