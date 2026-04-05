# Design System — Bartek Kowalski

## Product Context
- **What this is:** Personal portfolio for a Technical Product Manager and product engineer
- **Who it's for:** Recruiters, founders, and collaborators evaluating range across PM, engineering, and research
- **Space/industry:** Personal brand / portfolio
- **Project type:** Interactive portfolio — the main experience is a 3D Three.js rolodex wheel

## Aesthetic Direction
- **Direction:** Refined Editorial / Analog Archive
- **Decoration level:** minimal — the 3D rolodex IS the decoration; all chrome stays clean
- **Mood:** A well-designed portfolio monograph. Serious, with a point of view. The site feels like a person who has taste, not a template. Warm and confident, not corporate.

## Typography
- **Display/Hero:** Instrument Serif — editorial, literary, confident. Used for the name and any headline copy. Signals craft.
- **Body:** Geist Sans (already loaded via `next/font`) — clean, readable, no noise
- **UI/Labels:** Geist Sans (same as body)
- **Tags/Meta/Mono:** Geist Mono (already loaded via `next/font`) — dates, year labels, technology tags, code
- **Loading:** `next/font/google` for Instrument Serif; Geist and Geist Mono via `next/font/local` (already in project)
- **Scale:**
  - `3xl` display: clamp(48px, 6vw, 80px) / line-height 1.05 / tracking -0.02em
  - `2xl` display-italic: clamp(36px, 4.5vw, 60px) / line-height 1.1 / tracking -0.01em
  - `xl` heading: 22px / weight 500 / tracking -0.02em
  - `md` body: 15px / line-height 1.65
  - `sm` small: 13px / color muted
  - `xs` mono: 13px / tracking 0.04em

## Color
- **Approach:** restrained — one accent + warm neutrals; color is rare and meaningful
- **Background:** `#f7f4ec` — warm cream; keep exactly as-is
- **Surface:** `#ede9df` — slightly deeper cream for cards, panels, hover states
- **Border:** `#d8d3c9` — warm greige border
- **Foreground:** `#12100d` — warm near-black (has brownish undertone, not pure black)
- **Muted text:** `#7B7269` — warm greige; same temperature family as background
- **Accent:** `#4D5D43` — muted warm olive; use sparingly (active states, accent buttons, active borders). Not blue. Not purple.
- **Accent dark:** `#2d3e25` — for hover on accent elements
- **Semantic:**
  - success: `#4D5D43` (same as accent — olive works for success too)
  - warning: `#b07d2a`
  - error: `#a33a2e`
  - info: `#7B7269` (muted, non-alarming)
- **Dark mode:** Flip background to `#0f0d0a`, surface to `#1a1814`, border to `#2e2b26`, foreground to `#f0ece3`, muted to `#8a8278`, accent to `#6b8060` (desaturated ~10%)

## Spacing
- **Base unit:** 8px
- **Density:** comfortable
- **Scale:**
  - `2xs`: 2px
  - `xs`: 4px
  - `sm`: 8px
  - `md`: 16px
  - `lg`: 24px
  - `xl`: 32px
  - `2xl`: 48px
  - `3xl`: 64px

## Layout
- **Approach:** grid-disciplined — the rolodex owns the viewport, chrome is peripheral
- **Grid:** the rolodex canvas takes the full viewport; UI elements (name, hints) are positioned as overlays
- **Max content width:** 1200px for any non-canvas layouts
- **Border radius:** hierarchical — tags `4px`, cards `8px`, modals `16px`. Not uniform.
- **Name placement:** top-left corner, Instrument Serif, small and quiet — signals confidence without competing with the canvas

## Motion
- **Approach:** intentional — the rolodex does all heavy animation; all other UI is minimal
- **Easing:** enter `ease-out` / exit `ease-in` / state transitions `ease-in-out`
- **Duration:**
  - micro: 50–100ms (hover states, button presses)
  - short: 150–250ms (entrance fades, panel opens)
  - medium: 250–400ms (modal transitions — currently 420ms, adjust toward 350ms)
  - long: 400–700ms (page-level transitions if ever needed)
- **Rules:** No bounce. No spring exaggeration. No scroll-triggered choreography. The 3D canvas already handles the drama.

## CSS Custom Properties (reference implementation)

```css
:root {
  --bg:       #f7f4ec;
  --fg:       #12100d;
  --muted:    #7B7269;
  --accent:   #4D5D43;
  --accent-dark: #2d3e25;
  --surface:  #ede9df;
  --border:   #d8d3c9;

  --font-display: 'Instrument Serif', serif;
  --font-body:    var(--font-geist-sans), sans-serif;
  --font-mono:    var(--font-geist-mono), monospace;

  --r-sm:   4px;   /* tags */
  --r-md:   8px;   /* cards */
  --r-lg:   16px;  /* modals */

  --sp-2xs: 2px;
  --sp-xs:  4px;
  --sp-sm:  8px;
  --sp-md:  16px;
  --sp-lg:  24px;
  --sp-xl:  32px;
  --sp-2xl: 48px;
  --sp-3xl: 64px;
}
```

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-05 | Instrument Serif for display | Most PM portfolios are 100% geometric sans. A display serif creates an editorial voice and signals craft. Risk accepted: slightly literary. |
| 2026-04-05 | Olive accent `#4D5D43` | No one in this category uses warm olive. Blue is the PM default. This pairs naturally with cream and feels like considered branding. Use sparingly. |
| 2026-04-05 | Minimal chrome, maximum canvas | The rolodex IS the nav and the content. Name sits quietly top-left. No traditional nav grid. The 3D canvas is the differentiator. |
| 2026-04-05 | Keep `#f7f4ec` background exactly | Already perfect — warm cream signals analog/editorial. Do not neutralize toward pure white. |
| 2026-04-05 | Initial design system created | Created by /design-consultation |
