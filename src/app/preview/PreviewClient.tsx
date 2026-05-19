"use client";
import { useState, useEffect } from "react";
import Hero from "@/components/sections/Hero";
import Banner from "@/components/sections/Banner";
import TwoColumn from "@/components/sections/TwoColumn";
import Services from "@/components/sections/Services";
import GalleryClient from "@/components/sections/GalleryClient";
import Contact from "@/components/sections/Contact";
import type {
  PageSection,
  HeroSection,
  BannerSection,
  TwoColumnSection,
  ServicesSection,
  GallerySection,
  VideoSection,
} from "@/types/sections";

type AssetRow = { id: string; publicUrl: string; alt: string | null };

function GalleryPreview({ section }: { section: GallerySection }) {
  const [assets, setAssets] = useState<AssetRow[]>([]);

  useEffect(() => {
    const folder = section.mode === "dynamic" ? section.filters?.folder : undefined;
    const q = folder ? `?folder=${encodeURIComponent(folder)}` : "";
    fetch(`/api/assets${q}`)
      .then((r) => r.json())
      .then((data: any[]) => {
        let rows = data.filter((a) => a.publicUrl);
        if (section.mode === "static") {
          const order = new Map(section.assetIds.map((id, i) => [id, i]));
          rows = rows
            .filter((a) => order.has(a.id))
            .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
        } else {
          const tags = section.filters?.tags ?? [];
          if (tags.length) rows = rows.filter((a) => tags.some((t: string) => (a.tags ?? []).includes(t)));
        }
        setAssets(rows);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(section)]);

  if (assets.length === 0) return <div className="py-12 text-center text-sm text-gray-400">No images</div>;

  return (
    <>
      {(section.heading || section.body) && (
        <div className="max-w-7xl mx-auto px-4 mb-8">
          {section.heading && (
            <h2
              className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
              dangerouslySetInnerHTML={{ __html: section.heading }}
              style={{ color: "var(--color-text-heading)" }}
            />
          )}
          {section.body && (
            <p className="mt-4 max-w-3xl text-left" style={{ color: "var(--color-text-primary)" }}>
              {section.body}
            </p>
          )}
        </div>
      )}
      <GalleryClient assets={assets} layoutMode={section.layout ?? "grid"} />
    </>
  );
}

function renderContent(section: PageSection, bg?: string) {
  const type = section.type;

  if (type === "hero") {
    const s = section as HeroSection;
    return (
      <div style={{ backgroundColor: bg }}>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <Hero {...s} />
        </div>
      </div>
    );
  }
  if (type === "banner") {
    return <Banner {...(section as BannerSection)} />;
  }
  if (type === "twoColumn") {
    const s = section as TwoColumnSection;
    return (
      <div style={{ backgroundColor: bg }}>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <TwoColumn {...s} />
        </div>
      </div>
    );
  }
  if (type === "services") {
    const s = section as ServicesSection;
    const previewServices = (s as any).services?.filter((sv: any) => sv.image) ?? [];
    return (
      <div style={{ backgroundColor: bg }}>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <Services {...s} services={previewServices} />
        </div>
      </div>
    );
  }
  if (type === "gallery") {
    return (
      <div style={{ backgroundColor: bg }}>
        <div className="py-12">
          <GalleryPreview section={section as GallerySection} />
        </div>
      </div>
    );
  }
  if (type === "video") {
    const s = section as VideoSection;
    return (
      <div style={{ backgroundColor: bg }}>
        <div className="mx-auto max-w-7xl px-6 py-20">
          {(s.heading || s.subheading) && (
            <div className="mb-8">
              {s.heading && (
                <h2
                  className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
                  dangerouslySetInnerHTML={{ __html: s.heading }}
                  style={{ color: "var(--color-text-heading)" }}
                />
              )}
              {s.subheading && (
                <p className="mt-4 max-w-3xl text-left" style={{ color: "var(--color-text-primary)" }}>
                  {s.subheading}
                </p>
              )}
            </div>
          )}
          {s.videoUrl ? (
            <video src={s.videoUrl} className="w-full rounded" preload="metadata" muted playsInline />
          ) : (
            <div className="w-full aspect-video rounded bg-gray-100 flex items-center justify-center text-sm text-gray-400">
              No video selected
            </div>
          )}
        </div>
      </div>
    );
  }
  if (type === "contact") {
    const s = section as any;
    return (
      <div style={{ backgroundColor: bg }}>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <Contact {...s} pageSlug={typeof s.pageSlug === "string" ? s.pageSlug : "preview"} />
        </div>
      </div>
    );
  }
  return null;
}

export default function PreviewClient() {
  const [data, setData] = useState<{ section: PageSection; bg?: string } | null>(null);

  useEffect(() => {
    // Hide site nav/footer when rendered inside the admin preview iframe
    document.body.classList.add("preview-bare");

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "preview-data") {
        setData({ section: event.data.section as PageSection, bg: event.data.bg });
      }
    };
    window.addEventListener("message", handler);

    // Signal to parent that the iframe is ready to receive data
    window.parent.postMessage({ type: "preview-ready" }, "*");

    return () => {
      document.body.classList.remove("preview-bare");
      window.removeEventListener("message", handler);
    };
  }, []);

  // Report content height whenever rendered data changes
  useEffect(() => {
    if (!data) return;

    const postHeight = () => {
      const h = document.documentElement.scrollHeight;
      window.parent.postMessage({ type: "preview-height", height: h }, "*");
    };

    // Small delay allows CSS/layout to settle before measuring
    const timer = setTimeout(postHeight, 60);

    const ro = new ResizeObserver(postHeight);
    ro.observe(document.documentElement);

    const imgs = Array.from(document.querySelectorAll("img"));
    imgs.forEach((img) => img.addEventListener("load", postHeight));

    return () => {
      clearTimeout(timer);
      ro.disconnect();
      imgs.forEach((img) => img.removeEventListener("load", postHeight));
    };
  }, [data]);

  if (!data) return null;

  return <>{renderContent(data.section, data.bg)}</>;
}
