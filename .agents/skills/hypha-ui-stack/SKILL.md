---
name: hypha-ui-stack
description: Hypha UI stack: Tailwind CSS 4, shadcn/ui, Radix UI colors. Use when working with packages/ui, design tokens, component specs, or styling in hypha-web.
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

| Step | Use |
|------|-----|
| 1–2 | App backgrounds, subtle surfaces |
| 3–5 | Interactive component backgrounds |
| 6–8 | Borders, separators |
| 9–10 | Solid backgrounds (buttons, badges) |
| 11–12 | Text (low/high contrast) |

### Usage

- Use `bg-accent-9` for primary buttons; `bg-accent-2` for hover surfaces
- Use `text-accent-11` for links; `text-accent-12` for strong emphasis
- Use `--accent-contrast` for text on accent backgrounds

## References

- `packages/ui-utils/src/global.css` — full theme and tokens
- `packages/ui-utils/src/theme/` — color CSS files
- `packages/ui/src/button.tsx` — variant pattern reference
