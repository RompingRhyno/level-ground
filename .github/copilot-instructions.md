<!-- Copilot / AI agent instructions for the Level Ground repo -->
# Quick agent guide — Level Ground

Purpose: short, actionable notes to get an AI coding agent productive quickly.

Big picture
- Next.js (app-router) site under `src/app/` (Next 16, React 19). Pages are data-driven: a pages map in [src/lib/mockPages.ts](src/lib/mockPages.ts) supplies `sections` which are rendered by [src/components/RenderSections.tsx](src/components/RenderSections.tsx).
- UI is composed of small, typed section components defined in [src/types/sections.ts](src/types/sections.ts). `RenderSections` chooses the component by `section.type` (switch-case).

Key files to inspect
- `src/types/sections.ts` — canonical section types (add new section shapes here).
- `src/lib/mockPages.ts` — source-of-truth content (add/edit pages here for content-only changes).
- `src/components/RenderSections.tsx` — maps `type` → component (update here when adding new section kinds).
- `src/app/page.tsx` and `src/app/layout.tsx` — page entry and app shell (fonts, globals.css).

Developer workflows (scripts)
- `npm run dev` — local dev server (`next dev`).
- `npm run build` — build for production (`next build`).
- `npm run start` — run built app (`next start`).
- `npm run lint` — run `eslint`.

Project conventions (concrete rules)
- Data-first: prefer editing `src/lib/mockPages.ts` to change page content rather than layout code.
- Add a new section type:
  1. Add the type to `src/types/sections.ts`.
 2. Create a React component in `src/components/sections/` (named export default like existing ones).
 3. Extend the switch in `src/components/RenderSections.tsx` to return the component for that `type`.
- Keep imports using the `@/` alias (configured in `tsconfig.json`).
- Preserve `export const dynamic = "force-static"` on pages unless explicitly changing rendering behaviour.

Examples
- Add a page: add `pages.team = { sections: [...] }` in `src/lib/mockPages.ts` and create `src/app/team/page.tsx` modeled after [src/app/page.tsx](src/app/page.tsx).
- New section "faq": add `FAQSection` to `src/types/sections.ts`, create `src/components/sections/FAQ.tsx`, then add a `case "faq"` in `RenderSections`.

Notes & gotchas
- No API routes detected — this repo is static-first; avoid adding server runtime unless requested.
- Tailwind is present (see `package.json`); global CSS in `src/app/globals.css`.
- Fonts loaded via `next/font/google` in `layout.tsx` (check variable CSS classes).

When to ask clarifying questions
- If a change touches rendering strategy (SSR/ISR), ask whether to keep `dynamic = "force-static"` or move to a different rendering mode.
- If content should come from a CMS instead of `mockPages.ts`, ask for the CMS details and data shape.

If you want me to expand this guide with examples (code snippets for adding a page or section), say which example to include.

