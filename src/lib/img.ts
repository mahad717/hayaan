// Task 109: card-sized product images should never be raw Supabase uploads.
//
// The storage bucket holds original uploads — some are 100-340KB (one hero
// source is a 400x2560 phone-camera JPG). Every grid/category/search card
// renders it into an aspect-square box of ~170-400px, so the browser paid
// full-upload bytes for a thumbnail. The Supabase project has Image
// Transformations enabled, so we ask the render endpoint for a square,
// quality-75 WebP instead: the 341KB sample renders at ~14-25KB.
//
// Non-Supabase URLs (Unsplash hero photos, local /images/*, placeholders)
// pass through untouched, and callers keep an onError fallback to the
// original URL so a missing/deleted source can never blank a card.
const SB_MARKER = "supabase.co/storage/v1/object/public/product-images/";

export function productImg(url: string | null | undefined, size = 400): string {
  if (!url) return "/placeholder.svg";
  const i = url.indexOf(SB_MARKER);
  if (i === -1) return url;
  const base = url.slice(0, i);
  const path = url.slice(i + SB_MARKER.length);
  return `${base}supabase.co/storage/v1/render/image/public/product-images/${path}?width=${size}&height=${size}&resize=cover&quality=75&format=webp`;
}

// onError handler factory: swap a failed transform URL back to the original
// upload (then to the placeholder) so cards never render empty.
export function productImgFallback(original: string | null | undefined) {
  return (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (el.dataset.imgFb) return;
    el.dataset.imgFb = "1";
    el.src = original || "/placeholder.svg";
  };
}
