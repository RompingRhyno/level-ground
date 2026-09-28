import type { VideoSection } from "@/types/sections";
import { prisma } from "@/lib/prisma";
import VideoClient from "./VideoClient";

type VideoMeta = { poster?: string; variants?: { "720p"?: string; "1080p"?: string } };

export default async function Video(section: VideoSection) {
  // The section stores the video's public URL; the captured poster and the renditions live on the
  // asset row's meta (the upload pipeline writes meta.variants.{720p,1080p} + meta.poster).
  let poster: string | undefined;
  let variants: VideoMeta["variants"];
  if (section.videoUrl) {
    const asset = await prisma.asset.findFirst({
      where: { publicUrl: section.videoUrl },
      select: { meta: true },
    });
    const meta = asset?.meta as VideoMeta | null;
    poster = meta?.poster;
    variants = meta?.variants;
  }

  return (
    <section>
      {(section.heading || section.subheading) && (
        <div className="w-full px-4 md:px-8 mb-8">
          {section.heading && (
            <h2
              className="heading max-w-4xl text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
              dangerouslySetInnerHTML={{ __html: section.heading }}
              style={{ color: "var(--color-text-heading)" }}
            />
          )}
          {section.subheading && (
            <p
              className="mt-4 max-w-3xl text-left"
              style={{ color: "var(--color-text-primary)" }}
            >
              {section.subheading}
            </p>
          )}
        </div>
      )}
      <VideoClient src={section.videoUrl} poster={poster} variants={variants} />
    </section>
  );
}
