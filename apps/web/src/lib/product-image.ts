/**
 * Get the correct URL for a product image.
 *
 * Makito supplier images (apis.makito.es) require Bearer token authentication.
 * They are routed through /api/images/makito proxy which adds the auth header.
 *
 * MidOcean images (cdn1.midocean.com) are public — served directly.
 * Supabase Storage images are public — served directly.
 */
export function getProductImageUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;

  // Makito supplier images require auth — use server-side proxy
  if (imageUrl.includes('apis.makito.es')) {
    return `/api/images/makito?url=${encodeURIComponent(imageUrl)}`;
  }

  // All other images (MidOcean CDN, Supabase Storage) are publicly accessible
  return imageUrl;
}

/** Get the best image URL from a product's images array */
export function getFirstProductImage(
  images: string[] | null | undefined,
  variantImages?: string[] | null
): string | null {
  const url = images?.[0] ?? variantImages?.[0] ?? null;
  return getProductImageUrl(url);
}
