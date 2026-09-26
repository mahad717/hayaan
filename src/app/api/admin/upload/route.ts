// Admin upload → Supabase Storage. Two modes (Task 82):
//   • form field kind absent / "image"   → PUBLIC bucket "product-images",
//     keeps the products.images shape unchanged (it stores plain public
//     URLs), so all display code (cards, checkout, detail) works untouched.
//   • form field kind = "digital"        → PRIVATE bucket "digital-files";
//     any file type up to 50 MB. The response is an "sb://<bucket>/<path>"
//     reference stored on products.digital_url — the download endpoint signs
//     it per request (5-minute URLs), so the object never becomes public.
// Buckets are auto-created on first upload so no dashboard setup is needed.

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "product-images";
const DIGITAL_BUCKET = "digital-files";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
const DIGITAL_MAX_BYTES = 50 * 1024 * 1024; // 50 MB per digital file
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const ALLOWED_MIME = Object.keys(EXT_BY_TYPE);

// Ensure the bucket exists once per isolate; a failed attempt clears the
// cache so the next upload retries instead of caching the failure.
const bucketReady = new Map<string, Promise<void>>();

function ensureBucket(
  supabase: ReturnType<typeof createServiceClient>,
  bucket: string,
  options: { public: boolean; fileSizeLimit: string; allowedMimeTypes?: string[] },
): Promise<void> {
  let ready = bucketReady.get(bucket);
  if (!ready) {
    ready = (async () => {
      const client = supabase!;
      const { data: buckets, error: listErr } = await client.storage.listBuckets();
      if (listErr) throw new Error(listErr.message);
      if (buckets?.some((b) => b.name === bucket)) return;
      const { error: createErr } = await client.storage.createBucket(bucket, options);
      // Race with another isolate creating it is fine — ignore "exists".
      if (createErr && !/exists|duplicate|already/i.test(createErr.message)) {
        throw new Error(createErr.message);
      }
    })().catch((err) => {
      bucketReady.delete(bucket);
      throw err;
    });
    bucketReady.set(bucket, ready);
  }
  return ready;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  if (!isSupabaseServerEnabled || !createServiceClient()) {
    return NextResponse.json(
      { error: "Image storage is not configured on this deployment." },
      { status: 501 },
    );
  }
  const supabase = createServiceClient()!;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data." }, { status: 400 });
  }
  const kind = form.get("kind") === "digital" ? "digital" : "image";
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }

  // --- Digital mode: private bucket, any file type, 50 MB ---
  if (kind === "digital") {
    if (file.size > DIGITAL_MAX_BYTES) {
      return NextResponse.json({ error: "File is larger than 50 MB." }, { status: 413 });
    }
    // Sanitize the visible part of the name buyers keep (download filename).
    const safeBase =
      file.name
        .replace(/\.[^.]+$/, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "file";
    const ext = (/\.[A-Za-z0-9]{1,8}$/.exec(file.name)?.[0] ?? "").toLowerCase();
    const name = `${Date.now()}-${crypto.randomUUID()}-${safeBase}${ext}`;
    try {
      await ensureBucket(supabase, DIGITAL_BUCKET, { public: false, fileSizeLimit: `${DIGITAL_MAX_BYTES}` });
    } catch (err) {
      return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
    const { error: upErr } = await supabase.storage.from(DIGITAL_BUCKET).upload(name, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    // Private object — return a REFERENCE, never a public URL. The download
    // endpoint signs it per request.
    return NextResponse.json({ url: `sb://${DIGITAL_BUCKET}/${name}` });
  }

  // --- Image mode (unchanged behavior) ---
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 5 MB." }, { status: 413 });
  }
  const ext = EXT_BY_TYPE[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Unsupported image type — use JPG, PNG, WebP, or GIF." },
      { status: 415 },
    );
  }

  try {
    await ensureBucket(supabase, BUCKET, { public: true, fileSizeLimit: `${MAX_BYTES}`, allowedMimeTypes: ALLOWED_MIME });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  // Unique, unguessable object name; timestamp prefix keeps the bucket
  // listing roughly chronological for manual cleanup.
  const name = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(name, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
  return NextResponse.json({ url: data.publicUrl });
}
