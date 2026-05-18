"use client";
import { useState, useRef, useEffect, useCallback, useContext } from "react";
import type { PageSection } from "@/types/sections";
import { PreviewWidthContext } from "./PreviewWidthContext";

// ── SectionPreviewFrame (iframe-based) ────────────────────────────────────
// Renders section content inside an <iframe> whose CSS width equals the chosen
// preview viewport width. Because iframes have their own viewport, CSS media
// queries inside them fire based on the iframe's CSS width — not the browser
// window width — giving an accurate mobile/tablet/desktop layout preview.
export function SectionPreviewFrame({ section, bg }: { section: PageSection; bg?: string }) {
  const previewWidth = useContext(PreviewWidthContext);
  const measureRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // scale = how much to shrink the iframe to fit the editor panel
  const [scale, setScale] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number | null>(null);
  // rawHeight = the iframe's intrinsic scrollHeight (un-scaled)
  const [rawHeight, setRawHeight] = useState(300);
  const [iframeReady, setIframeReady] = useState(false);

  // Keep a ref to scale so the message handler always sees the latest value
  const scaleRef = useRef(scale);
  scaleRef.current = scale;

  // Measure available editor width and compute scale
  const measureScale = useCallback(() => {
    if (!measureRef.current) return;
    const available = measureRef.current.offsetWidth;
    if (!available) return;
    const containerW = Math.min(available, previewWidth);
    setScale(containerW / previewWidth);
    setContainerWidth(containerW);
  }, [previewWidth]);

  useEffect(() => {
    measureScale();
    const ro = new ResizeObserver(measureScale);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => ro.disconnect();
  }, [measureScale]);

  // Send section data whenever the iframe signals ready or data changes
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "preview-data", section, bg },
      window.location.origin,
    );
  }, [iframeReady, section, bg]);

  // Handle messages from the iframe (preview-ready + preview-height).
  // Empty dep array is intentional: iframeRef and scaleRef are stable refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (event.data?.type === "preview-ready") {
        setIframeReady(true);
      } else if (event.data?.type === "preview-height") {
        setRawHeight(event.data.height as number);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const containerHeight = rawHeight * scale;

  return (
    <div className="mt-3 px-3 pb-3">
      {/* Invisible full-width sentinel — measures available editor space */}
      <div ref={measureRef} className="w-full" style={{ height: 0, overflow: "hidden" }} />
      <div
        style={{
          width: containerWidth ?? "100%",
          marginLeft: containerWidth ? "auto" : undefined,
          marginRight: containerWidth ? "auto" : undefined,
        }}
      >
        <div className="block text-sm text-gray-500 mb-1">Preview</div>
        <div
          style={{
            width: "100%",
            height: containerHeight,
            overflow: "hidden",
            position: "relative",
            transition: "height 150ms ease",
            border: "2px solid var(--color-brand-dark)",
            borderRadius: "0.25rem",
          }}
        >
          <iframe
            ref={iframeRef}
            src="/preview"
            title="Section preview"
            style={{
              width: previewWidth,
              height: rawHeight,
              border: "none",
              display: "block",
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              pointerEvents: "none",
              // Fade in once the iframe has reported its content height
              opacity: iframeReady ? 1 : 0,
              transition: "opacity 0.15s ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ── SectionPreview ─────────────────────────────────────────────────────────
export default function SectionPreview({ section, index }: { section: PageSection; index: number }) {
  const type = section.type;
  // Banner is full-bleed — it manages its own bg
  const bg = type === "banner"
    ? undefined
    : index % 2 === 0
      ? "var(--color-bg-primary)"
      : "var(--color-bg-secondary)";

  return <SectionPreviewFrame section={section} bg={bg} />;
}
