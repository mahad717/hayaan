"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Copy, Check, FileText, ImagePlus, Loader2, Newspaper, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useStore } from "@/hooks/use-store";
import type { BlogPost } from "@/lib/types";
import { BLOG_SETUP_SQL } from "@/lib/blog-setup-sql";

// Local slug helper — lib/blog's version pulls in server-only modules.
function slugifyLocal(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "post"
  );
}

interface PostForm {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  authorName: string;
  status: "draft" | "published";
}

const EMPTY_FORM: PostForm = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  coverImage: "",
  authorName: "Hayaan Team",
  status: "draft",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export function AdminBlog() {
  const { toast } = useStore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [tableMissing, setTableMissing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<BlogPost | null>(null);
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sqlCopied, setSqlCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/blog", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPosts(data.posts ?? []);
        setTableMissing(Boolean(data.tableMissing));
      } else {
        toast(data.error ?? "Failed to load blog posts", "error");
      }
    } catch {
      toast("Network error while loading blog posts", "error");
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setDialogOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditing(post);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage ?? "",
      authorName: post.authorName,
      status: post.status,
    });
    setSlugTouched(true);
    setDialogOpen(true);
  };

  const setTitle = (title: string) => {
    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugifyLocal(title) }));
  };

  const uploadCover = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const file = files[0];
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd, credentials: "include" });
      const data = await res.json().catch(() => ({} as { error?: string; url?: string }));
      if (!res.ok || !data.url) {
        toast(data.error ?? "Upload failed", "error");
      } else {
        setForm((f) => ({ ...f, coverImage: data.url }));
        toast("Cover image uploaded", "success");
      }
    } catch {
      toast("Upload failed", "error");
    }
    setUploading(false);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast("Title and content are required.", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(editing ? `/api/admin/blog/${editing.id}` : "/api/admin/blog", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Save failed", "error");
        return;
      }
      toast(editing ? "Post updated" : "Post created", "success");
      setDialogOpen(false);
      load();
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (post: BlogPost) => {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    const res = await fetch(`/api/admin/blog/${post.id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      toast("Post deleted", "success");
      load();
    } else {
      toast("Delete failed", "error");
    }
  };

  const copySetupSql = async () => {
    try {
      await navigator.clipboard.writeText(BLOG_SETUP_SQL);
      setSqlCopied(true);
      setTimeout(() => setSqlCopied(false), 2000);
    } catch {
      toast("Copy failed — select the SQL manually.", "error");
    }
  };

  return (
    <Card className="mt-6 border-[#e6e2d4]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base text-brand-dark">
          <Newspaper className="h-4 w-4 text-brand" /> Blog posts ({posts.length})
        </CardTitle>
        <Button onClick={openNew} size="sm" variant="outline" className="border-brand/50 text-brand hover:bg-secondary">
          <Plus className="mr-1 h-4 w-4" /> New post
        </Button>
      </CardHeader>
      <CardContent>
        {tableMissing && (
          <div className="mb-4 rounded-lg border border-[#f28c28]/40 bg-[#fef1de] p-4">
            <p className="text-sm font-semibold text-[#7a4a14]">One-time setup needed</p>
            <p className="mt-1 text-xs leading-relaxed text-[#7a4a14]/90 font-original">
              The blog table doesn't exist in Supabase yet. Click the button to copy the setup SQL,
              paste it in your Supabase dashboard (SQL editor → New query), and run it. This is the
              same one-click pattern as the original store seed.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" onClick={copySetupSql} className="btn-accent">
                {sqlCopied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {sqlCopied ? "Copied!" : "Copy setup SQL"}
              </Button>
              <a
                href="https://supabase.com/dashboard/project/_/sql/new"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs font-medium text-[#7a4a14] underline"
              >
                Open Supabase SQL editor <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs text-[#7a4a14]/80">Show SQL</summary>
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-white/80 p-3 text-[11px] leading-relaxed text-[#4b3820]">
                {BLOG_SETUP_SQL}
              </pre>
            </details>
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-muted/40" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground font-original">
            No posts yet. Click “New post” to write your first article.
          </p>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-background">
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-3 pr-4">Title</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Updated</th>
                  <th className="py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {posts.map((post) => (
                  <tr key={post.id} className="border-t hover:bg-muted/30">
                    <td className="py-3 pr-4">
                      <p className="line-clamp-1 font-medium text-foreground">{post.title}</p>
                      <p className="text-xs text-muted-foreground">/blog/{post.slug}</p>
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant="secondary"
                        className={post.status === "published" ? "bg-secondary text-brand" : "bg-[#fef1de] text-[#7a4a14]"}
                      >
                        {post.status}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-xs text-muted-foreground">{formatDate(post.updatedAt)}</td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-1">
                        {post.status === "published" && (
                          <Button asChild variant="ghost" size="icon" className="h-8 w-8 text-brand" aria-label={`View ${post.title}`}>
                            <Link href={`/blog/${post.slug}`} target="_blank">
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-brand" onClick={() => openEdit(post)} aria-label={`Edit ${post.title}`}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(post)} aria-label={`Delete ${post.title}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      {/* Editor dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-brand-dark">{editing ? "Edit blog post" : "New blog post"}</DialogTitle>
            <DialogDescription>
              Content supports simple markdown: ## headings, - lists, **bold**, *italic*, [links](url), &gt; quotes.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={save} className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="bp-title">Title <span className="text-[#f28c28]">*</span></Label>
              <Input
                id="bp-title"
                value={form.title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="5 things to check before buying a LED strip"
                className="border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25"
                required
              />
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="bp-slug">URL slug</Label>
                <Input
                  id="bp-slug"
                  value={form.slug}
                  onChange={(e) => { setSlugTouched(true); setForm((f) => ({ ...f, slug: e.target.value })); }}
                  placeholder="auto-generated from the title"
                  className="border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25"
                />
                <p className="text-xs text-muted-foreground font-original">hayaan.co/blog/{form.slug || "…"}</p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bp-author">Author</Label>
                <Input
                  id="bp-author"
                  value={form.authorName}
                  onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                  className="border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25"
                />
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="bp-excerpt">Excerpt <span className="text-xs font-normal text-muted-foreground">(shown on the blog index)</span></Label>
              <Textarea
                id="bp-excerpt"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                rows={2}
                placeholder="One or two sentences that summarize the article."
                className="border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="bp-cover">Cover image</Label>
              <div className="flex items-center gap-3">
                {form.coverImage ? (
                  <img src={form.coverImage} alt="" className="h-14 w-24 rounded-md border border-[#e6e2d4] object-cover" />
                ) : (
                  <div className="flex h-14 w-24 items-center justify-center rounded-md border border-dashed border-brand/40 bg-[#faf8f1]">
                    <FileText className="h-5 w-5 text-brand/50" aria-hidden />
                  </div>
                )}
                <label className="flex cursor-pointer items-center gap-1.5 rounded-md border border-brand/50 px-3 py-2 text-xs font-bold text-brand transition hover:bg-secondary">
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  {uploading ? "Uploading…" : "Upload"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => uploadCover(e.target.files)}
                    disabled={uploading}
                  />
                </label>
                {form.coverImage && (
                  <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setForm((f) => ({ ...f, coverImage: "" }))}>
                    Remove
                  </Button>
                )}
              </div>
              <Input
                value={form.coverImage}
                onChange={(e) => setForm((f) => ({ ...f, coverImage: e.target.value }))}
                placeholder="…or paste an image URL"
                className="mt-1 border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25"
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="bp-content">Content <span className="text-[#f28c28]">*</span></Label>
              <Textarea
                id="bp-content"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                rows={12}
                placeholder={"Write the article in simple markdown…\n\n## A heading\n\nA paragraph with **bold** and [a link](https://example.com).\n\n- A list item\n- Another item"}
                className="min-h-72 border-brand/50 hover:border-brand/70 focus-visible:border-brand focus-visible:ring-brand/25"
                required
              />
            </div>

            <div className="grid gap-1.5 sm:w-48">
              <Label htmlFor="bp-status">Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as PostForm["status"] }))}>
                <SelectTrigger id="bp-status" className="border-brand/50 hover:border-brand/70">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft — hidden from the blog</SelectItem>
                  <SelectItem value="published">Published — live on /blog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="mt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="btn-accent">
                {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : form.status === "published" ? "Publish post" : "Save draft"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
