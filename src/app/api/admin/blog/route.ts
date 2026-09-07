import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import {
  listAllPosts,
  createPost,
  uniqueSlug,
  slugify,
  isMissingTableError,
} from "@/lib/blog";
import type { BlogStatus } from "@/lib/types";

/** Admin blog listing — includes drafts. GET /api/admin/blog */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { posts, tableMissing } = await listAllPosts();
  return NextResponse.json({ posts, tableMissing });
}

/** Create a post. POST /api/admin/blog */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "");
  if (!title || !content.trim()) {
    return NextResponse.json({ error: "Title and content are required." }, { status: 400 });
  }

  const slug = await uniqueSlug(String(body?.slug ?? "").trim() || slugify(title));
  const status: BlogStatus = body?.status === "published" ? "published" : "draft";

  try {
    const post = await createPost({
      title,
      slug,
      excerpt: String(body?.excerpt ?? "").trim(),
      content,
      coverImage: body?.coverImage ? String(body.coverImage) : null,
      authorName: String(body?.authorName ?? "").trim() || "Hayaan Team",
      status,
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
