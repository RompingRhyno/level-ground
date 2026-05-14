import type { VideoSection } from "@/types/sections";
import VideoClient from "./VideoClient";

export default function Video(section: VideoSection) {
  return (
    <section>
      {(section.heading || section.subheading) && (
        <div className="max-w-7xl mx-auto px-4 mb-8">
          {section.heading && (
            <h2
              className="heading text-3xl sm:text-3xl md:text-5xl font-light leading-tight mb-6"
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
      <div className="max-w-7xl mx-auto px-4">
        <VideoClient src={section.videoUrl} />
      </div>
    </section>
  );
}
