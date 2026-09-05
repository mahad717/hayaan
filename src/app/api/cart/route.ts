import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/current-user";
import type { Cart, Product } from "@/lib/types";

function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    price: Number(row.price),
    compareAt: row.compareAt != null ? Number(row.compareAt) : null,
    currency: row.currency ?? "USD",
    sku: row.sku ?? null,
    stock: row.stock,
    rating: row.rating,
    reviewCount: row.reviewCount,
    images: Array.isArray(row.images) ? row.images : JSON.parse(row.images || "[]"),
    tags: Array.isArray(row.tags) ? row.tags : JSON.parse(row.tags || "[]"),
    featured: row.featured,
    isActive: row.isActive,
    categoryId: row.categoryId ?? row.category_id,
  };
}

async function buildCart(userId: string): Promise<Cart> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data: carts } = await supabase
      .from("carts")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    let cartId = carts?.[0]?.id;
    if (!cartId) {
      const { data: created } = await supabase
        .from("carts")
        .insert({ user_id: userId })
        .select("id")
        .single();
      cartId = created?.id;
    }
    const { data: items } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(*)")
      .eq("cart_id", cartId);
    return {
      id: cartId ?? "",
      items: (items ?? []).map((it: any) => ({
        id: it.id,
        productId: it.product.id,
        quantity: it.quantity,
        product: rowToProduct(it.product),
      })),
    };
  }

  let cart = await db.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: { include: { category: true } } } } },
  });
  if (!cart) {
    cart = await db.cart.create({ data: { userId }, include: { items: { include: { product: { include: { category: true } } } } } });
  }
  return {
    id: cart.id,
    items: cart.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      quantity: it.quantity,
      product: rowToProduct(it.product),
    })),
  };
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ cart: { id: "", items: [] } });
  const cart = await buildCart(user.id);
  return NextResponse.json({ cart });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in to add items to your cart." }, { status: 401 });
  const { productId, quantity = 1, action = "set" } = await req.json();
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const cart = await buildCart(user.id);
    const existing = cart.items.find((i) => i.productId === productId);
    if (existing) {
      const newQty = action === "increment" ? existing.quantity + quantity : action === "decrement" ? Math.max(1, existing.quantity - quantity) : quantity;
      const { error } = await supabase.from("cart_items").update({ quantity: newQty }).eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await supabase.from("cart_items").insert({ cart_id: cart.id, product_id: productId, quantity });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const updated = await buildCart(user.id);
    return NextResponse.json({ cart: updated });
  }

  let cart = await db.cart.findUnique({ where: { userId: user.id }, include: { items: true } });
  if (!cart) {
    cart = await db.cart.create({ data: { userId: user.id }, include: { items: true } });
  }
  const existing = cart.items.find((i) => i.productId === productId);
  if (existing) {
    const newQty =
      action === "increment"
        ? existing.quantity + quantity
        : action === "decrement"
          ? Math.max(1, existing.quantity - quantity)
          : quantity;
    await db.cartItem.update({ where: { id: existing.id }, data: { quantity: newQty } });
  } else {
    await db.cartItem.create({ data: { cartId: cart.id, productId, quantity } });
  }
  const updated = await buildCart(user.id);
  return NextResponse.json({ cart: updated });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("itemId");
  const clearAll = searchParams.get("clear") === "true";

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const cart = await buildCart(user.id);
    if (clearAll) {
      await supabase.from("cart_items").delete().eq("cart_id", cart.id);
    } else if (itemId) {
      await supabase.from("cart_items").delete().eq("id", itemId);
    }
    const updated = await buildCart(user.id);
    return NextResponse.json({ cart: updated });
  }

  if (clearAll) {
    await db.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
  } else if (itemId) {
    await db.cartItem.delete({ where: { id: itemId } });
  }
  const updated = await buildCart(user.id);
  return NextResponse.json({ cart: updated });
}
