// Blog data layer — server-side only.
//
// Dual path, like every other store API route:
//   • Supabase (production) via the service-role client.
//   • Prisma + SQLite (local preview) via getDb().
//
// Supabase is NOT guaranteed to have the blog_posts table yet (it ships via
// src/lib/supabase/migrations/2026-09-07-blog-posts.sql), so every read /
// write detects the missing-table error (PostgREST PGRST205 / "relation does
// not exist" / 42P01) and reports `tableMissing: true` instead of throwing —
// pages render a friendly empty state and the admin panel surfaces setup SQL.

import { getDb } from "@/lib/db";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";
import type { BlogPost, BlogStatus } from "@/lib/types";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "post";
}

function rowToPost(row: any): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt ?? "",
    content: row.content ?? "",
    coverImage: row.coverImage ?? row.cover_image ?? null,
    authorName: row.authorName ?? row.author_name ?? "Hayaan Team",
    status: (row.status ?? "draft") as BlogStatus,
    publishedAt: row.publishedAt ?? row.published_at ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

/** Detects Supabase's "table does not exist" family of errors. */
export function isMissingTableError(err: { message?: string; code?: string }): boolean {
  const msg = (err?.message ?? "").toLowerCase();
  return (
    err?.code === "PGRST205" ||
    msg.includes("could not find the table") ||
    msg.includes("does not exist") ||
    msg.includes("42p01") ||
    msg.includes("no such table")
  );
}

export async function listPublishedPosts(limit = 50): Promise<{ posts: BlogPost[]; tableMissing: boolean }> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(limit);
    if (error) {
      if (isMissingTableError(error)) return { posts: [], tableMissing: true };
      throw new Error(error.message);
    }
    return { posts: (data ?? []).map(rowToPost), tableMissing: false };
  }

  try {
    const posts = await (await getDb()).blogPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: limit,
    });
    return { posts: posts.map(rowToPost), tableMissing: false };
  } catch (err: any) {
    if (isMissingTableError(err)) return { posts: [], tableMissing: true };
    throw err;
  }
}

export async function getPublishedPostBySlug(slug: string): Promise<BlogPost | null> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) {
      if (isMissingTableError(error)) return null;
      throw new Error(error.message);
    }
    return data ? rowToPost(data) : null;
  }

  try {
    const post = await (await getDb()).blogPost.findFirst({
      where: { slug, status: "published" },
    });
    return post ? rowToPost(post) : null;
  } catch (err: any) {
    if (isMissingTableError(err)) return null;
    throw err;
  }
}

/** Admin listing — every status, newest activity first. */
export async function listAllPosts(): Promise<{ posts: BlogPost[]; tableMissing: boolean }> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    if (error) {
      if (isMissingTableError(error)) return { posts: [], tableMissing: true };
      throw new Error(error.message);
    }
    return { posts: (data ?? []).map(rowToPost), tableMissing: false };
  }

  try {
    const posts = await (await getDb()).blogPost.findMany({
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return { posts: posts.map(rowToPost), tableMissing: false };
  } catch (err: any) {
    if (isMissingTableError(err)) return { posts: [], tableMissing: true };
    throw err;
  }
}

/** Guarantees a unique slug: appends -2, -3, … on collisions. */
export async function uniqueSlug(base: string, ignoreId?: string): Promise<string> {
  const root = slugify(base);
  const taken = new Set<string>();

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase.from("blog_posts").select("id, slug");
    if (error) {
      // If the table is missing there is nothing to collide with yet.
      if (isMissingTableError(error)) return root;
      throw new Error(error.message);
    }
    for (const row of data ?? []) {
      if (row.id !== ignoreId) taken.add(row.slug);
    }
  } else {
    const rows = await (await getDb()).blogPost.findMany({ select: { id: true, slug: true } });
    for (const row of rows) {
      if (row.id !== ignoreId) taken.add(row.slug);
    }
  }

  if (!taken.has(root)) return root;
  for (let i = 2; i < 100; i++) {
    const candidate = `${root}-${i}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export type BlogWriteInput = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  authorName: string;
  status: BlogStatus;
};

/** First publish stamps published_at; later edits keep the original stamp. */
export async function createPost(input: BlogWriteInput): Promise<BlogPost> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("blog_posts")
      .insert({
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        content: input.content,
        cover_image: input.coverImage,
        author_name: input.authorName,
        status: input.status,
        published_at: input.status === "published" ? new Date().toISOString() : null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToPost(data);
  }
  const post = await (await getDb()).blogPost.create({
    data: {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      coverImage: input.coverImage,
      authorName: input.authorName,
      status: input.status,
      publishedAt: input.status === "published" ? new Date() : null,
    },
  });
  return rowToPost(post);
}

export async function updatePost(id: string, input: BlogWriteInput & { keepPublishedAt?: string | null }): Promise<BlogPost> {
  const publishedAt =
    input.status === "published" ? input.keepPublishedAt ?? new Date().toISOString() : null;

  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { data, error } = await supabase
      .from("blog_posts")
      .update({
        title: input.title,
        slug: input.slug,
        excerpt: input.excerpt,
        content: input.content,
        cover_image: input.coverImage,
        author_name: input.authorName,
        status: input.status,
        published_at: publishedAt,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return rowToPost(data);
  }
  const post = await (await getDb()).blogPost.update({
    where: { id },
    data: {
      title: input.title,
      slug: input.slug,
      excerpt: input.excerpt,
      content: input.content,
      coverImage: input.coverImage,
      authorName: input.authorName,
      status: input.status,
      publishedAt: publishedAt ? new Date(publishedAt) : null,
      updatedAt: new Date(),
    },
  });
  return rowToPost(post);
}

export async function deletePost(id: string): Promise<void> {
  if (isSupabaseServerEnabled) {
    const supabase = createServiceClient()!;
    const { error } = await supabase.from("blog_posts").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return;
  }
  await (await getDb()).blogPost.delete({ where: { id } });
}
