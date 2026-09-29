-- Hidden from dynamic galleries (folder/tag filtered, collection index, /projects detail) and ordered last
-- so it can never become a folder cover. Still renders in static galleries and in the pickers.
-- See docs/transition-groups-plan.md.
ALTER TABLE "Asset" ADD COLUMN "hidden" BOOLEAN NOT NULL DEFAULT false;
