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

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  image?: string | null;
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
}
