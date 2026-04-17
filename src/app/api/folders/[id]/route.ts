import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: any) {
  try {
    let p: any = context?.params as any;
    if (p && typeof p.then === "function") p = await p;
    const id = Number(p?.id);
    const body = await request.json();
    const { name, slug, parentId } = body;
    const data: any = {};
    if (name) data.name = name;
    if (slug) data.slug = slug;
    if (typeof parentId !== "undefined") data.parentId = parentId;

    const updated = await prisma.folder.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: any) {
  try {
    let p: any = context?.params as any;
    if (p && typeof p.then === "function") p = await p;
    const id = Number(p?.id);
    // Optionally, you may want to handle cascading asset moves/deletes here.
    const deleted = await prisma.folder.delete({ where: { id } });
    return NextResponse.json({ success: true, deleted });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || String(err) }, { status: 500 });
  }
}
