import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

const MAX_CLEANUP_ATTEMPTS = 5;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  const auth = request.headers.get("Authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;

  if (!accessKeyId || !secretAccessKey || !accountId || !bucket) {
    return NextResponse.json({ error: "SERVER_MISCONFIGURED" }, { status: 500 });
  }

  const { S3Client, DeleteObjectCommand } = await import("@aws-sdk/client-s3");

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: false,
  });

  const now = new Date();

  // Load expired sessions with their uploads
  const expiredSessions = await prisma.contactUploadSession.findMany({
    where: { expiresAt: { lte: now } },
    include: { uploads: true },
  });

  let deletedSlots = 0;
  let skippedSlots = 0;
  let deadLettered = 0;
  let deletedSessions = 0;

  for (const session of expiredSessions) {
    // 1. USED uploads: preserve R2, delete DB row
    const usedIds = session.uploads.filter((u) => u.status === "used").map((u) => u.id);
    if (usedIds.length > 0) {
      await prisma.contactUpload
        .deleteMany({ where: { id: { in: usedIds } } })
        .catch(() => {});
      deletedSlots += usedIds.length;
    }

    // 2. Non-terminal uploads: attempt R2 delete
    const toClean = session.uploads.filter(
      (u) =>
        (u.status === "pending" || u.status === "uploaded" || u.status === "cleanup_failed") &&
        u.cleanupAttempts < MAX_CLEANUP_ATTEMPTS,
    );

    for (const upload of toClean) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: upload.key }));
        // R2 deletion succeeded — delete DB row
        await prisma.contactUpload.delete({ where: { id: upload.id } }).catch(() => {});
        deletedSlots++;
      } catch (err: unknown) {
        const statusCode = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
          ?.httpStatusCode;

        if (statusCode === 404) {
          // Object already gone — clean up DB row
          await prisma.contactUpload.delete({ where: { id: upload.id } }).catch(() => {});
          deletedSlots++;
        } else {
          // Transient or permanent failure — increment retry counter
          const newAttempts = upload.cleanupAttempts + 1;
          const isDead = newAttempts >= MAX_CLEANUP_ATTEMPTS;
          await prisma.contactUpload
            .update({
              where: { id: upload.id },
              data: {
                cleanupAttempts: newAttempts,
                ...(isDead && { status: "cleanup_failed" }),
              },
            })
            .catch(() => {});
          if (isDead) deadLettered++;
          else skippedSlots++;
        }
      }
    }

    // 3. Delete session if no uploads remain
    const remaining = await prisma.contactUpload
      .count({ where: { sessionId: session.id } })
      .catch(() => -1);

    if (remaining === 0) {
      await prisma.contactUploadSession
        .delete({ where: { id: session.id } })
        .catch(() => {});
      deletedSessions++;
    }
  }

  return NextResponse.json({ deletedSlots, skippedSlots, deadLettered, deletedSessions });
}
