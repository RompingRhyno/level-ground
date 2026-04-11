import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { files, folder = "" } = body;

  if (!Array.isArray(files) || files.length === 0) {
    return NextResponse.json({ error: "missing files array" }, { status: 400 });
  }

  const { S3Client } = await import("@aws-sdk/client-s3");
  const { createPresignedPost } = await import("@aws-sdk/s3-presigned-post");

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined;

  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    return NextResponse.json({ error: "R2 credentials not configured" }, { status: 500 });
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const base = process.env.R2_BASE_URL;
  if (!base) {
    return NextResponse.json({ error: "R2_BASE_URL not configured" }, { status: 500 });
  }

  const results: Array<{ filename: string; key: string; url: string; fields: Record<string, string>; publicUrl: string }> = [];

  for (const f of files) {
    const { filename } = f as { filename: string };
    if (!filename) continue;
    const key = `${folder ? folder.replace(/\/$/, "") + "/" : ""}${Date.now()}-${filename}`;

    // generate presigned POST
    const presigned = await createPresignedPost(s3 as any, {
      Bucket: bucket,
      Key: key,
      // no Content-Type condition so provider can infer and avoid preflight
      Conditions: [],
      Fields: {},
      Expires: 3600,
    } as any);

    results.push({ filename, key, url: presigned.url, fields: presigned.fields, publicUrl: `${base.replace(/\/$/, "")}/${key}` });
  }

  return NextResponse.json({ results });
}
