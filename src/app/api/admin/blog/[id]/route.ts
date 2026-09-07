import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import {
  updatePost,
  deletePost,
  uniqueSlug,
  slugify,
  isMissingTableError,
  getPublishedPostBySlug,
} from "@/lib/blog";
import type { BlogStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

/** Update a post. PUT /api/admin/blog/[id] */
export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "");
  if (!title || !content.trim()) {
    return NextResponse.json({ error: "Title and content are required." }, { status: 400 });
  }

  const slug = await uniqueSlug(String(body?.slug ?? "").trim() || slugify(title), id);
  const status: BlogStatus = body?.status === "published" ? "published" : "draft";

  // Keep the original publish stamp on edits of already-live posts.
  const existing = await getPublishedPostBySlug(slug).catch(() => null);

  try {
    const post = await updatePost(id, {
      title,
      slug,
      excerpt: String(body?.excerpt ?? "").trim(),
      content,
      coverImage: body?.coverImage ? String(body.coverImage) : null,
      authorName: String(body?.authorName ?? "").trim() || "Hayaan Team",
      status,
      keepPublishedAt: existing?.publishedAt ?? null,
    });
    return NextResponse.json({ post });
  } catch (err: any) {
    if (isMissingTableError(err)) {
      return NextResponse.json(
        { error: "The blog_posts table doesn't exist yet — run the setup SQL from the Blog section.", tableMissing: true },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

/** Delete a post. DELETE /api/admin/blog/[id] */
export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  try {
    await deletePost(id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (isMissingTableError(err)) {
      return NextResponse.json({ error: "The blog_posts table doesn't exist yet.", tableMissing: true }, { status: 409 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
