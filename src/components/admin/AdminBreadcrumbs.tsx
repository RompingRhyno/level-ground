"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

export default function AdminBreadcrumbs() {
  const pathname = usePathname() || "/admin";
  const parts = pathname.split("/").filter(Boolean); // e.g. ['admin','files']
  const section = parts[1] ?? ""; // second segment (e.g. 'files')
  const isAdminRoot = pathname === "/admin" || pathname === "/admin/" || section === "";
  const title = section ? section.charAt(0).toUpperCase() + section.slice(1) : "";

  return (
    <nav className="text-base text-gray-700 flex items-center gap-2">
      <Link href="/admin" className="text-gray-900 font-semibold">Admin</Link>
      {!isAdminRoot && section && (
        <>
          <span className="text-gray-400">›</span>
          <span className="text-gray-900">{title}</span>
        </>
      )}
    </nav>
  );
}
