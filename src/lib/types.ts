// Shared domain types. These mirror the Prisma models and also work against
// the Supabase schema in `src/lib/supabase/schema.sql`.

export type Role = "customer" | "admin";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  // Saved shipping profile — present when resolved from the profile store
  // (public.users in Supabase mode, Prisma User locally). Optional because
  // some resolution paths (JWT metadata only) don't carry them.
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  zip?: string | null;
  country?: string | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
}

export type ProductType = "physical" | "digital";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compareAt?: number | null;
  currency: string;
  sku?: string | null;
  stock: number;
  rating: number;
  reviewCount: number;
  images: string[];
  tags: string[];
  featured: boolean;
  isActive: boolean;
  categoryId: string;
  category?: Category;
  // Digital delivery (Task 82): digital products skip shipping entirely and
  // unlock a download link once the order is paid. The public product API
  // maps ONLY productType — digitalUrl/digitalInstructions never leave the
  // server except through the gated /api/digital/download endpoint.
  productType: ProductType;
  // Admin-only fields (same confidentiality model as supplier data): the
  // download URL can be an external https link or an "sb://<bucket>/<path>"
  // reference to a private Supabase Storage object (signed at download time).
  digitalUrl?: string | null;
  digitalInstructions?: string | null;
  // Dropshipping sourcing (Task 65) — admin-only fields; the public product
  // API never maps them, so customers never see supplier data.
  supplierUrl?: string | null;
  supplierSku?: string | null;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
}

export interface Cart {
  id: string;
  items: CartItem[];
}

export type OrderStatus = "pending" | "paid" | "shipped" | "delivered" | "cancelled";

// Customer product review (Task 85). Public payload — the reviewer's user id
// rides along ONLY in the author's own view (ownership checks); the public
// list maps it out. Server shape shared by the PDP, the review APIs, and the
// admin moderation queue.
export interface ProductReview {
  id: string;
  productId: string;
  rating: number; // 1..5
  authorName: string;
  comment: string;
  verifiedPurchase: boolean;
  status: "approved" | "hidden";
  createdAt: string;
  updatedAt: string;
  /** Present only on "my review" responses (same user requesting). */
  userId?: string;
}

export interface ReviewSummary {
  average: number; // 1 decimal, 0 when no reviews
  count: number;
  /** Count per star 1..5 (approved only) — drives the PDP distribution bars. */
  distribution?: Record<string, number>;
}

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
  // True when the snapshot product was a digital download (drives the
  // Download button in Orders). Resolved server-side via a product join —
  // the download URL itself is never on the order item.
  isDigital?: boolean;
  digitalInstructions?: string | null;
}

export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  totalAmount: number;
  currency: string;
  shippingName: string;
  shippingPhone?: string | null;
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  shippingCountry: string;
  paymentMethod: string;
  paymentRef?: string | null;
  // Real-gateway payment state: "pending" | "paid" | "failed".
  // Demo methods (card/paypal/cod) keep the default "pending" — the order
  // status field is what carries "paid" for them.
  paymentStatus?: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface ShippingInfo {
  name: string;
  phone?: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}

export type BlogStatus = "draft" | "published";

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  /** Markdown-lite content (headings, lists, bold/italic, links, quotes). */
  content: string;
  coverImage: string | null;
  authorName: string;
  status: BlogStatus;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Where the post lives: "db" = blog_posts table (fully editable),
   *  "shipped" = code-shipped SEO guide (Task 73; admin can copy it into
   *  the DB by saving an edit). Absent on older API consumers. */
  source?: "db" | "shipped";
  /** AEO (Task 77): 40-60 word direct answer rendered above the content —
   *  the "quick answer" pattern answer engines quote verbatim. */
  quickAnswer?: string;
  /** AEO (Task 77): buyer questions rendered as a visible FAQ block and
   *  emitted as FAQPage structured data on the post page. */
  faqs?: Array<{ q: string; a: string }>;
  /** AEO (Task 77): ordered steps for HowTo structured data (procedural
   *  guides like "how online shopping works"). */
  howtoSteps?: Array<{ name: string; text: string }>;
}
