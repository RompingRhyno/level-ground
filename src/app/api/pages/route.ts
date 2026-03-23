import { NextResponse } from "next/server";
import { getPages, upsertPage } from "@/lib/pages";

export async function GET() {
  const pages = await getPages();
  return NextResponse.json(pages);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body || !body.slug) {
      return NextResponse.json({ error: "missing slug" }, { status: 400 });
    }

    const saved = await upsertPage(body);

    return NextResponse.json(saved);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

