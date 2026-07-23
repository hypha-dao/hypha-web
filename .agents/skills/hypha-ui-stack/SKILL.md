---
name: hypha-ui-stack
description: 'Hypha UI stack: Tailwind CSS 4, shadcn/ui, Radix UI colors. Use when working with packages/ui, design tokens, component specs, or styling in hypha-web.'
---

# Hypha UI Stack

The hypha-web design system is built on Tailwind CSS 4, shadcn/ui, and Radix UI colors. All UI work must align with these technologies.

## Tailwind CSS 4

- **Version:** `tailwindcss ^4.0.8`
- **Config:** `@theme` in `packages/ui-utils/src/global.css` — no `tailwind.config.js`
- **Entry:** `@import 'tailwindcss'` with `@source` for content scanning
- **Dark mode:** `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))`
- **Key:** Use `@theme` blocks for design tokens; utilities map to CSS variables.

### Tailwind 4 Conventions

- Colors: `--color-*` in `@theme` → `bg-accent-9`, `text-foreground`
- Spacing: `--spacing-*` → `p-4`, `gap-5`
- Radius: `--radius-sm`, `--radius-md`, `--radius-lg`
- No arbitrary values when tokens exist — use `bg-accent-9` not `bg-[#123]`

## shadcn/ui

- **Add components:** `pnpm add-component` (runs `shadcn@latest add` in packages/ui)
- **Location:** `packages/ui/src/` — atoms, molecules, organisms
- **Styling:** Uses `cn()` from `@hypha-platform/ui-utils` for class merging
- **Pattern:** Radix primitives + CVA (class-variance-authority) for variants

### Component Conventions

- Use `cva()` for variant/size logic; compound variants for combinations
- Default: `variant: default`, `size: default`, `colorVariant: accent`
- Color variants: `accent`, `neutral`, `error`, `success` (see `button.tsx`)

## Radix UI Colors

- **Format:** 12-step scales (1–12) for each semantic palette
- **Color space:** OKLCH
- **Palettes:** accent (indigo), neutral (slate), background (gray), error (red), success (green), warning (amber), info (sky)

### Scale Mapping (Radix convention)

| Step  | Use                                 |
| ----- | ----------------------------------- |
| 1–2   | App backgrounds, subtle surfaces    |
| 3–5   | Interactive component backgrounds   |
| 6–8   | Borders, separators                 |
| 9–10  | Solid backgrounds (buttons, badges) |
| 11–12 | Text (low/high contrast)            |

### Usage

- Use `bg-accent-9` for primary buttons; `bg-accent-2` for hover surfaces
- Use `text-accent-11` for links; `text-accent-12` for strong emphasis
- Use `--accent-contrast` for text on accent backgrounds

## Craft rules

Award-oriented product UI: crisp, calm, intentional — not soft SaaS / AI-glow.

### Radius family

| Surface                                                     | Prefer                                                                                                                   |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Cards / panels / menus / dialogs                            | `rounded-lg` → `--radius-lg`                                                                                             |
| Chrome controls (header icon buttons, small square avatars) | `APP_CHROME_SUBTLE_SQUARE_RADIUS` (`rounded-chrome` → `--radius-chrome`) in `packages/epics/src/common/chrome-radius.ts` |
| Avoid on product chrome                                     | `rounded-xl`, `rounded-2xl`                                                                                              |

### Fonts

- Single UI face: **IBM Plex Sans** via `--font-body` → `--font-family-text` / `--font-family-heading`
- Avoid decorative display serifs (Fraunces, etc.) inside the app — they read as AI brand kits
- Do not leave Next font CSS variables unwired

### Precision-tool craft (anti-decorative)

- Flat chrome: solid `bg-background-2`, hairline borders — **no** page washes, frosted blur bars, or empty-state glow
- Page headers: `.craft-page-header` / `.craft-page-title` — left-aligned, tool-sized (not centered marketing heroes)
- Empty states: quiet `.craft-empty-mark` (border only)
- Avoid stagger enter animations and accent-tinted title lines

### Cards & elevation

- Cards are interaction containers: border + subtle `hover:bg-muted/…` step
- No default `hover:shadow-md` lift or glow stacks (`shadow-[0_0_…]`)
- Prefer `shadow-sm` / `shadow-md` when depth is needed; avoid `shadow-xl` / `shadow-2xl`
- Borders: `border-border` / `border-border/80` — not raw hex (e.g. `#30363d`)
- Raw `indigo-*` and `border-blue-500` → `accent-*` / `border-accent-9`

### Accent dialects (three)

1. **Global indigo** — Radix `accent-*` (buttons, focus, mention chips, links)
2. **Space** — `--space-accent*` from imagery; inside `[data-space-accent-scope]` CTAs/tabs/focus own the space hue (`space-accent.css`)
3. **Mycelium teal** — ecosystem / viz only; do not use as app chrome accent

## References

- `packages/ui-utils/src/global.css` — full theme and tokens
- `packages/ui-utils/src/theme/craft.css` — quiet page-header / empty utilities
- `packages/ui/src/button.tsx` — variant pattern reference
- `packages/epics/src/common/chrome-radius.ts` — chrome control radius token
