// Shared domain types. These mirror the Prisma models and also work against
// the Supabase schema in `src/lib/supabase/schema.sql`.

export type Role = "customer" | "admin";

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  role: Role;
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
  shippingAddress: string;
  shippingCity: string;
  shippingZip: string;
  shippingCountry: string;
  paymentMethod: string;
  paymentRef?: string | null;
  items: OrderItem[];
  createdAt: string;
}

export interface ShippingInfo {
  name: string;
  address: string;
  city: string;
  zip: string;
  country: string;
}
