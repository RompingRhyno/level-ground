"use client";

import { useEffect, useState } from "react";
import { serviceAnchorHref, type Service } from "@/lib/services";

/**
 * The live service list for client components. Services can be created from the tag modal, so the
 * static list in lib/services.ts is only a pre-load fallback — this hook fetches the real list once
 * per session (module cache) and callers resolve hrefs against it when it arrives.
 */

let cache: Service[] | null = null;
let inflight: Promise<Service[]> | null = null;

function load(): Promise<Service[]> {
  if (!inflight) {
    inflight = fetch("/api/services")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Service[]) => (cache = Array.isArray(rows) ? rows : []))
      .catch(() => (cache = []));
  }
  return inflight;
}

export function useServices(): Service[] | null {
  const [services, setServices] = useState<Service[] | null>(cache);
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

/** Resolve a cover's service slug to its service-page anchor, live list first. */
export function useServiceHref(): (slug: string | null | undefined) => string | null {
  const services = useServices();
  return (slug) => {
    if (!slug) return null;
    if (!services) return serviceAnchorHref(slug);
    const service = services.find((s) => s.slug === slug);
    if (!service) return null;
    const page = service.group === "maintenance" ? "/landscape-maintenance" : "/landscape-design-installation";
    return `${page}#${service.slug}`;
  };
}
