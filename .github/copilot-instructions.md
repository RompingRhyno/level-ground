<!-- Copilot / AI agent instructions for the Level Ground repo -->
# Quick agent guide — Level Ground

Purpose: help AI coding agents be productive quickly by describing architecture, conventions, and exact files to edit.

Big picture
- This is a Next.js (app-router) site in `src/app/` using the new Next 16 APIs and React 19. Core rendering is data-driven: pages are built from a `pages` map in `src/lib/mockPages.ts` and rendered by `src/components/RenderSections.tsx`.
- UI is composed of small, typed section components (see `src/types/sections.ts`) — the code selects component by `section.type` (switch in `RenderSections`).

Key files to inspect
- Data model: `src/types/sections.ts` — canonical type definitions for all section shapes.
- Mock content/source of truth: `src/lib/mockPages.ts` — pages keyed by slug (e.g., "about") with `sections: Section[]`.
- Renderer: `src/components/RenderSections.tsx` — maps `Section.type` to components: `Hero`, `TwoColumn`, `Gallery`, `CTA`.
- Page entry: `src/app/page.tsx` (and other pages under `src/app`) — example uses `const page = pages["about"]; return <RenderSections sections={page.sections} />;` and sets `export const dynamic = "force-static"`.
- App shell: `src/app/layout.tsx` — global fonts, `globals.css` and base HTML structure.

Developer workflows
- Run dev: `npm run dev` (script `next dev`).
- Build: `npm run build` (script `next build`).
- Start prod: `npm run start` (script `next start`).
- Lint: `npm run lint` (runs `eslint`).
- The project uses TypeScript path alias `@/` -> `./src` (see `tsconfig.json` paths). Use these imports consistently.

Conventions / patterns agents should follow
- Data-first pages: prefer editing or adding entries in `src/lib/mockPages.ts` for content changes instead of modifying page components unless layout/behaviour must change.
- Polymorphic sections: add new section types by (1) adding a type in `src/types/sections.ts`, (2) creating a component in `src/components/sections/`, and (3) extending the `switch` in `RenderSections.tsx`.
- Keys: components use array `index` as `key` in `RenderSections`. When adding reusable lists consider switching to a stable `id` field on sections.
- Styling: Tailwind is present (see `package.json` devDependencies). Global CSS is in `src/app/globals.css`.

Integration & external notes
- Next version: pinned to `next@16.0.10`. React 19 is used — be mindful of new runtime/behavioral changes.
- Fonts: Google fonts via `next/font/google` in `layout.tsx`.
- No server / API routes detected — this is a primarily static site generator pattern (pages built from local data).

What to modify for common tasks (explicit examples)
- Add a new page "team": add `pages.team = { sections: [...] }` to `src/lib/mockPages.ts` and create `src/app/team/page.tsx` modeled after `src/app/page.tsx` that loads `pages['team']`.
- Add new section type "faq":
  1. Add `FAQSection` to `src/types/sections.ts`.
  2. Create `src/components/sections/FAQ.tsx` that accepts the type props.
  3. Update `RenderSections.tsx` switch to return `<FAQ key={index} {...section} />` for `case "faq"`.

Agent behavior rules (practical, repo-specific)
- Preserve `export const dynamic = "force-static"` where present unless explicitly changing rendering strategy.
- Keep imports using `@/` path alias.
- Avoid adding runtime server code — this repo is structured as a static-first site.
- When touching types, update both the type file and any mocks in `src/lib/mockPages.ts` to keep examples compileable.

Diagnostics & quick checks
- If TypeScript import errors appear, confirm `tsconfig.json` includes path mappings (`@/*` -> `./src/*`).
- Run `npm run lint` to catch stylistic issues; no test runner configured.

If something is missing or unclear, ask for the intended deployment target (Vercel, static host) or where real content is stored (CMS or local mocks). Request sample content or desired section behavior before implementing new UX-heavy components.

— end —
