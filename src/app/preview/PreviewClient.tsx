"use client";
import { useState, useEffect } from "react";
import Hero from "@/components/sections/Hero";
import Banner from "@/components/sections/Banner";
import TwoColumn from "@/components/sections/TwoColumn";
import Services from "@/components/sections/Services";
import type {
  PageSection,
  HeroSection,
  BannerSection,
  TwoColumnSection,
  ServicesSection,
} from "@/types/sections";

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
