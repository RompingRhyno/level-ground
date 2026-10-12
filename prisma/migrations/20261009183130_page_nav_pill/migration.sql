-- Page.navPill: per-page switch that renders this page's sticky-header nav entry as a pill button
-- (the `.btn-primary` style the home hero's "Get a quote" uses) instead of the underlined link, for extra
-- emphasis. Per page rather than global: the nav lists every page, so emphasis is chosen one entry at a time.
-- Default false, so existing pages keep the underline.
ALTER TABLE "Page" ADD COLUMN "navPill" BOOLEAN NOT NULL DEFAULT false;
