/**
 * TEMPORARY — storage headroom: what is in R2 and in the database, against the free tier.
 *
 *   npx tsx scripts/tmp-storage-usage.ts
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const FREE_GB = 10;
const OVERAGE_PER_GB = 0.015;

async function main() {
  const prisma = (await import("../src/lib/prisma")).default;

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID as string,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY as string,
    },
  });

  let token: string | undefined;
  let total = 0;
  const byPrefix = new Map<string, { n: number; bytes: number }>();
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: process.env.R2_BUCKET_NAME as string, ContinuationToken: token }),
    );
    for (const o of res.Contents ?? []) {
      const size = o.Size ?? 0;
      total += size;
      const prefix = (o.Key ?? "").split("/").slice(0, 2).join("/") || "(root)";
      const entry = byPrefix.get(prefix) ?? { n: 0, bytes: 0 };
      entry.n += 1;
      entry.bytes += size;
      byPrefix.set(prefix, entry);
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);

  const mb = (b: number) => (b / 1024 / 1024).toFixed(1) + " MB";
  console.log(`bucket ${process.env.R2_BUCKET_NAME}: ${mb(total)} in ${[...byPrefix.values()].reduce((a, b) => a + b.n, 0)} objects`);
  for (const [prefix, e] of [...byPrefix].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${prefix.padEnd(28)} ${String(e.n).padStart(3)} objects  ${mb(e.bytes)}`);
  }

  const rows = await prisma.asset.findMany({ select: { size: true, folder: true } });
  const dbTotal = rows.reduce((a, r) => a + (r.size ?? 0), 0);
  console.log(`\ndatabase asset rows: ${rows.length}, summing ${mb(dbTotal)} (originals only — derived variants live in meta)`);

  const gb = total / 1024 / 1024 / 1024;
  console.log(`\nfree tier: ${FREE_GB} GB`);
  console.log(`used: ${gb.toFixed(3)} GB (${((gb / FREE_GB) * 100).toFixed(1)}% of the free tier)`);
  if (gb > FREE_GB) {
    console.log(`over by ${(gb - FREE_GB).toFixed(3)} GB → about $${((gb - FREE_GB) * OVERAGE_PER_GB).toFixed(2)}/month at $${OVERAGE_PER_GB}/GB`);
  } else {
    console.log(`headroom: ${(FREE_GB - gb).toFixed(3)} GB left; exceeding it costs $${OVERAGE_PER_GB}/GB-month, so filling a second 10 GB would add about $${(FREE_GB * OVERAGE_PER_GB).toFixed(2)}/month`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("failed:", err);
  process.exit(1);
});
