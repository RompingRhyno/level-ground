import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const folder = url.searchParams.get("folder");
  const where: any = {};
  if (folder) where.folder = folder;

  const rows = await prisma.asset.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, filename, mime, size, folder, publicUrl, alt, tags } = body;
    if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

    const created = await prisma.asset.create({ data: { storageKey: key, provider: "r2", filename, mime, size, folder, publicUrl, alt, meta: { uploadedAt: new Date().toISOString() }, tags } });
    return NextResponse.json(created);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
