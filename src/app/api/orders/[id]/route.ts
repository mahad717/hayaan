import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import { getUserFromRequest } from "@/lib/auth-session";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("orders")
      .select("*, items:order_items(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();
    if (error) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({
      order: {
        ...data,
        totalAmount: Number(data.total_amount),
        items: (data.items ?? []).map((it: any) => ({ ...it, price: Number(it.price) })),
        createdAt: data.created_at,
      },
    });
  }
  const order = await db.order.findFirst({
    where: { id, userId: user.id },
    include: { items: true },
  });
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  return NextResponse.json({
    order: {
      ...order,
      items: order.items,
      createdAt: order.createdAt.toISOString(),
    },
  });
}
