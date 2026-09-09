// Admin image upload → Supabase Storage public bucket "product-images".
// Keeps the products.images shape unchanged (it still stores plain public
// URLs), so all display code (cards, checkout, detail) works untouched.
// The bucket is auto-created on first upload so no dashboard setup is needed.

import { NextRequest, NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/current-user";
import { isSupabaseServerEnabled, createServiceClient } from "@/lib/supabase/server";

const BUCKET = "product-images";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB per image
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
const ALLOWED_MIME = Object.keys(EXT_BY_TYPE);

// Ensure the bucket exists once per isolate; a failed attempt clears the
// cache so the next upload retries instead of caching the failure.
let bucketReady: Promise<void> | null = null;

function ensureBucket(supabase: ReturnType<typeof createServiceClient>): Promise<void> {
  if (!bucketReady) {
    bucketReady = (async () => {
      const client = supabase!;
      const { data: buckets, error: listErr } = await client.storage.listBuckets();
      if (listErr) throw new Error(listErr.message);
      if (buckets?.some((b) => b.name === BUCKET)) return;
      const { error: createErr } = await client.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: `${MAX_BYTES}`,
        allowedMimeTypes: ALLOWED_MIME,
      });
      // Race with another isolate creating it is fine — ignore "exists".
      if (createErr && !/exists|duplicate|already/i.test(createErr.message)) {
        throw new Error(createErr.message);
      }
    })().catch((err) => {
      bucketReady = null;
      throw err;
    });
  }
  return bucketReady;
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
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file received." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "File is empty." }, { status: 400 });
  }
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
    await ensureBucket(supabase);
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
