"use client";

import { useEffect, useState } from "react";
import { serviceAnchorHref } from "@/lib/services";

/** A row from /api/services: the live vocabulary plus the resolver's answer for where it lives. */
type LiveService = { slug: string; name: string; group: string; href: string; hasSection?: boolean };

/**
 * The live service list for client components. Services can be created from the tag modal, so the
 * static list in lib/services.ts is only a pre-load fallback — this hook fetches the real list once
 * per session (module cache) and callers resolve hrefs against it when it arrives.
 */

let cache: LiveService[] | null = null;
let inflight: Promise<LiveService[]> | null = null;

function load(): Promise<LiveService[]> {
  if (!inflight) {
    inflight = fetch("/api/services")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: LiveService[]) => (cache = Array.isArray(rows) ? rows : []))
      .catch(() => (cache = []));
  }
  return inflight;
}

export function useServices(): LiveService[] | null {
  const [services, setServices] = useState<LiveService[] | null>(cache);
  useEffect(() => {
    if (cache) return;
    let live = true;
    load().then((rows) => {
      if (live) setServices(rows);
    });
    return () => {
      live = false;
    };
  }, []);
  return services;
}

/**
 * Resolve a cover's service slug to where that service actually lives. The href comes from the
 * server resolver (via /api/services), so a section bound anywhere — any page — links correctly;
 * before the fetch resolves, the static fallback keeps the old behavior.
 */
export function useServiceHref(): (slug: string | null | undefined) => string | null {
  const services = useServices();
  return (slug) => {
    if (!slug) return null;
    if (!services) return serviceAnchorHref(slug);
    return services.find((s) => s.slug === slug)?.href ?? null;
  };
}
