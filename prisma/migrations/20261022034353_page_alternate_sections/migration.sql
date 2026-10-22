-- Per-page alternating section backgrounds, off by default (see 2b625fc, which removed the old
-- unconditional index-parity tint).
ALTER TABLE "Page" ADD COLUMN "alternateSections" BOOLEAN NOT NULL DEFAULT false;
