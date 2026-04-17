import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(request: NextRequest, context: any) {
  try {
    let p: any = context?.params as any;
    if (p && typeof p.then === "function") p = await p;
    const id = p?.id;

    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const asset = await prisma.asset.findUnique({ where: { id } });
    if (!asset) return NextResponse.json({ error: "not found" }, { status: 404 });

    console.info(`/api/assets/${id} DELETE asset:`, { id, provider: asset.provider, storageKey: asset.storageKey });

    // Attempt to delete from R2 if provider is r2
    if (asset.provider === "r2" && asset.storageKey) {
      try {
        const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

        const accessKeyId = process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
        const accountId = process.env.R2_ACCOUNT_ID;
        const bucket = process.env.R2_BUCKET_NAME;
        const endpoint = accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined;

        if (accessKeyId && secretAccessKey && accountId && bucket) {
          const client = new S3Client({ region: "auto", endpoint, credentials: { accessKeyId, secretAccessKey } });
          const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: asset.storageKey });
          await client.send(cmd as any);
          console.info('Deleted object from R2', asset.storageKey);
        } else {
          console.warn('R2 delete skipped - missing R2 credentials or config', { accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey, accountId: !!accountId, bucket: !!bucket });
        }
      } catch (err) {
        console.warn("failed to delete from r2", err);
      }
    }

    await prisma.asset.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error(`/api/assets/[id] DELETE error:`, err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: any) {
  try {
    // unwrap params if framework provides a promise
    let p: any = context?.params as any;
    if (p && typeof p.then === "function") p = await p;
    const id = p?.id;

    const body = await request.json().catch((e) => {
      console.error("/api/assets/[id] invalid JSON body", e);
      return null;
    });

    console.info(`/api/assets/${id} PATCH body:`, body);

    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const { filename, folder, alt, tags } = body || {};
    const data: any = {};
    if (filename) data.filename = filename;
    if (typeof folder !== "undefined") data.folder = folder;
    if (typeof alt !== "undefined") data.alt = alt;
    if (typeof tags !== "undefined") data.tags = tags;

    const updated = await prisma.asset.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    console.error(`/api/assets/[id] PATCH error:`, err);
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
