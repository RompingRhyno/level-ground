import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json();
  const { filename, contentType, folder = "" } = body;

  if (!filename || !contentType) {
    return NextResponse.json(
      { error: "missing filename or contentType" },
      { status: 400 }
    );
  }

  const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const { getSignedUrl } = await import("@aws-sdk/s3-request-presigner");

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  const endpoint = accountId
    ? `https://${accountId}.r2.cloudflarestorage.com`
    : undefined;

  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    return NextResponse.json(
      { error: "R2 credentials not configured" },
      { status: 500 }
    );
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: false,
  });

  const key = `${folder ? folder.replace(/\/$/, "") + "/" : ""}${Date.now()}-${filename}`;

  const cmd = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(s3 as any, cmd as any, {
    expiresIn: 3600,
  });

  const base = process.env.R2_BASE_URL;

  if (!base) {
    return NextResponse.json(
      { error: "R2_BASE_URL not configured" },
      { status: 500 }
    );
  }

  const publicUrl = `${base.replace(/\/$/, "")}/${key}`;

  return NextResponse.json({ uploadUrl, key, publicUrl });
}