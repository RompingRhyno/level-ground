import type { VideoSection } from "@/types/sections";
import { prisma } from "@/lib/prisma";
import VideoStage from "./VideoStage";

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
      <VideoStage
        heading={section.heading}
        subheading={section.subheading}
        src={section.videoUrl}
        poster={poster}
        variants={variants}
      />
    </section>
  );
}
