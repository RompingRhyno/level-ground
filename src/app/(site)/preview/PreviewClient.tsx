"use client";
import { useState, useEffect } from "react";
import Hero from "@/components/sections/Hero";
import Banner from "@/components/sections/Banner";
import TwoColumn from "@/components/sections/TwoColumn";
import Services from "@/components/sections/Services";
import GalleryClient from "@/components/sections/GalleryClient";
import Contact from "@/components/sections/Contact";
import CollectionItemClient from "@/components/sections/CollectionItemClient";
import CollectionIndexPresentation from "@/components/sections/CollectionIndexPresentation";
import type {
  PageSection,
  HeroSection,
  BannerSection,
  TwoColumnSection,
  ServicesSection,
  GallerySection,
  VideoSection,
  CollectionIndexSection,
  CollectionItemSection,
} from "@/types/sections";

type AssetRow = { id: string; publicUrl: string; alt: string | null };

function GalleryPreview({ section }: { section: GallerySection }) {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [displayTags, setDisplayTags] = useState<{ slug: string; name: string }[]>([]);

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
          const filterTags = section.filters?.tags ?? [];
          if (filterTags.length) {
            // Filter assets by folder membership — a.tags no longer exists
            const activeFolderSlugs: string[] = data
              .filter((a: any) => a.folder)
              .map((a: any) => a.folder)
              .filter((v: string, i: number, arr: string[]) => arr.indexOf(v) === i);
            // We need to know which folders have these tags, but we only have asset data here.
            // As a best-effort client-side preview, include assets whose folder matches section.filters.folder,
            // or all assets if we can't filter (server-side Gallery component is authoritative).
            // No-op: show all for preview.
          }
        }
        setAssets(rows);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(section)]);

  // Resolve display tags for preview (best-effort, non-clickable)
  useEffect(() => {
    const td = section.tagDisplay;
    if (!td?.enabled) { setDisplayTags([]); return; }

    if (td.mode === "manual" && td.tags?.length) {
      fetch("/api/tags")
        .then((r) => r.json())
        .then((all: { slug: string; name: string }[]) => {
          const selected = all.filter((t) => td.tags!.includes(t.slug));
          selected.sort((a, b) => a.name.localeCompare(b.name));
          setDisplayTags(selected);
        })
        .catch(() => setDisplayTags([]));
      return;
    }

    if (td.mode === "auto") {
      // Best-effort: fetch assets, derive folders, union tags
      const folder = section.mode === "dynamic" ? (section as any).filters?.folder : undefined;
      const q = folder ? `?folder=${encodeURIComponent(folder)}` : "";
      fetch(`/api/assets${q}`)
        .then((r) => r.json())
        .then((data: any[]) => {
          const folderSlugs = [...new Set(data.map((a: any) => a.folder).filter(Boolean))] as string[];
          if (!folderSlugs.length) { setDisplayTags([]); return; }
          return fetch("/api/folders")
            .then((r) => r.json())
            .then((folders: { slug: string; tags: string[] }[]) => {
              const relevant = folders.filter((f) => folderSlugs.includes(f.slug));
              const tagSlugs = [...new Set(relevant.flatMap((f) => f.tags))];
              if (!tagSlugs.length) { setDisplayTags([]); return; }
              return fetch("/api/tags")
                .then((r) => r.json())
                .then((all: { slug: string; name: string }[]) => {
                  const resolved = all.filter((t) => tagSlugs.includes(t.slug));
                  resolved.sort((a, b) => a.name.localeCompare(b.name));
                  setDisplayTags(resolved);
                });
            });
        })
        .catch(() => setDisplayTags([]));
      return;
    }

    setDisplayTags([]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(section.tagDisplay), section.mode, (section as any).filters?.folder]);

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
      {displayTags.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 mb-6 flex flex-wrap gap-2">
          {displayTags.map((tag) => (
            <span key={tag.slug} className="admin-btn text-sm px-3 py-1 rounded-full">
              {tag.name}
            </span>
          ))}
        </div>
      )}
      <GalleryClient assets={assets} layoutMode={section.layout ?? "grid"} />
    </>
  );
}

function CollectionItemPreview({ section }: { section: CollectionItemSection }) {
  const { source = "folders", layout = "grid", lightbox = true } = section;
  type Entity = { name: string; description: string | null; displayTags: { slug: string; name: string }[]; assets: AssetRow[] };
  const [entity, setEntity] = useState<Entity | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const endpoint = source === "folders" ? "/api/folders" : "/api/tags";
        const items: any[] = await fetch(endpoint).then((r) => r.json());
        const first = items[0];
        if (!first) {
          if (!cancelled) setEntity(null);
          return;
        }

        const param = source === "folders" ? "folder" : "tag";
        const [assetsData, tagsData] = await Promise.all([
          fetch(`/api/assets?${param}=${encodeURIComponent(first.slug)}`).then((r) => r.json()),
          source === "folders" && Array.isArray(first.tags) && first.tags.length
            ? fetch("/api/tags").then((r) => r.json())
            : Promise.resolve([]),
        ]);

        if (cancelled) return;

        const assets: AssetRow[] = (assetsData as any[])
          .filter((a: any) => a.publicUrl && (!a.mime || a.mime.startsWith("image/")))
          .map((a: any) => ({ id: a.id, publicUrl: a.publicUrl, alt: a.alt ?? null }));

        let displayTags: { slug: string; name: string }[] = [];
        if (source === "folders" && Array.isArray(first.tags)) {
          const tagNameMap = Object.fromEntries((tagsData as any[]).map((t: any) => [t.slug, t.name]));
          displayTags = (first.tags as string[])
            .filter((t) => t !== "before" && t !== "after")
            .map((s: string) => ({ slug: s, name: tagNameMap[s] ?? s }));
        }

        setEntity({ name: first.name, description: first.description ?? null, displayTags, assets });
      } catch {
        if (!cancelled) setEntity(null);
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  if (entity === undefined) return null;

  if (entity === null) {
    return (
      <div
        className="rounded border border-dashed p-8 text-center space-y-2"
        style={{ borderColor: "var(--color-brand-dark)", color: "var(--color-text-muted)" }}
      >
        <div className="text-lg font-light" style={{ color: "var(--color-text-heading)" }}>
          Collection Item
        </div>
        <p className="text-sm">
          Heading, tags, description and gallery load dynamically from the collection entity.
        </p>
        <p className="text-xs">
          Layout: <strong>{layout}</strong> · Lightbox:{" "}
          <strong>{lightbox ? "on" : "off"}</strong>
        </p>
      </div>
    );
  }

  return (
    <CollectionItemClient
      name={entity.name}
      description={entity.description}
      displayTags={entity.displayTags}
      assets={entity.assets}
      layout={layout}
      lightbox={lightbox}
    />
  );
}

function CollectionIndexPreview({ section }: { section: CollectionIndexSection }) {
  const { source, heading, entityImages, showTagFilter, maxItems } = section as any;
  const [items, setItems] = useState<{ slug: string; name: string }[]>([]);
  const [firstAssets, setFirstAssets] = useState<Record<string, string>>({});
  const [folderTags, setFolderTags] = useState<Record<string, string[]>>({});
  const [allTags, setAllTags] = useState<{ slug: string; name: string }[]>([]);
  const [activePreviewTag, setActivePreviewTag] = useState<string | null>(null);

  useEffect(() => {
    const endpoint = source === "folders" ? "/api/folders" : "/api/tags";
    fetch(endpoint)
      .then((r) => r.json())
      .then((data: any[]) => {
        setItems((data || []).map((d: any) => ({ slug: d.slug, name: d.name })));
        if (source === "folders") {
          setFolderTags(
            Object.fromEntries((data || []).map((f: any) => [f.slug, f.tags ?? []]))
          );
        }
      })
      .catch(() => {});
  }, [source]);

  useEffect(() => {
    if (!items.length) return;
    const param = source === "folders" ? "folder" : "tag";
    let cancelled = false;
    Promise.all(
      items.map((item) =>
        fetch(`/api/assets?${param}=${encodeURIComponent(item.slug)}`)
          .then((r) => r.json())
          .then((assets: any[]) => {
            const first = assets.find(
              (a: any) => a.publicUrl && (!a.mime || a.mime.startsWith("image/"))
            );
            return { slug: item.slug, url: first?.publicUrl as string | undefined };
          })
          .catch(() => ({ slug: item.slug, url: undefined }))
      )
    ).then((results) => {
      if (cancelled) return;
      setFirstAssets(Object.fromEntries(results.filter((r) => r.url).map((r) => [r.slug, r.url!])));
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), source]);

  useEffect(() => {
    if (source !== "folders") return;
    fetch("/api/tags")
      .then((r) => r.json())
      .then((d: any[]) => setAllTags(d || []))
      .catch(() => {});
  }, [source]);

  const usedTagSlugs = new Set(Object.values(folderTags).flat());
  const filterTags = allTags.filter((t) => usedTagSlugs.has(t.slug));
  const tagNameBySlug = Object.fromEntries(allTags.map((t) => [t.slug, t.name]));
  const filteredItems = activePreviewTag
    ? items.filter((item) => (folderTags[item.slug] ?? []).includes(activePreviewTag))
    : items;
  const visibleItems = maxItems ? filteredItems.slice(0, maxItems) : filteredItems;

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <CollectionIndexPresentation
        heading={heading}
        items={visibleItems}
        firstAssets={firstAssets}
        entityImages={entityImages}
        source={source}
        folderTags={folderTags}
        tagNameBySlug={tagNameBySlug}
        allTagsForFilter={filterTags}
        showTagFilter={showTagFilter}
        effectiveRouteBase=""
        activeTag={activePreviewTag}
        onTagClick={(slug) => setActivePreviewTag(slug)}
      />
    </div>
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
  if (type === "collection-index") {
    return (
      <div style={{ backgroundColor: bg }}>
        <CollectionIndexPreview section={section as CollectionIndexSection} />
      </div>
    );
  }
  if (type === "collection-item") {
    const s = section as CollectionItemSection;
    return (
      <div style={{ backgroundColor: bg }} className="mx-auto max-w-7xl px-6 py-20">
        <CollectionItemPreview section={s} />
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
