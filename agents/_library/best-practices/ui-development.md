### UI Development Best Practices

#### Do

- Use Tailwind CSS v4 utility classes — configuration via `@theme` blocks in CSS, not `tailwind.config`
- Use the 12-step color scale: `accent-1..12`, `background-1..12`, `error-1..12`, etc.
- Use `cn()` for conditional/merged classNames — never string concatenation
- Build on shadcn/ui primitives (Button, Card, Dialog, Form, Input, Select) — don't reinvent
- Support dark mode via `[data-theme=dark]` custom variant and `.dark` class
- Use `--spacing-{1..9}` and `--text-{1..9}` design tokens for consistent sizing
- Respect the font system: `Lato` (headings, `--font-heading`), `Source Sans 3` (body, `--font-body`)
- Write Storybook stories for reusable components

#### Avoid

- Inline styles — use Tailwind utilities
- Hardcoded colors — use semantic tokens (`foreground`, `accent-*`, `background-*`)
- Creating new UI primitives when shadcn/ui has an equivalent
- Putting data fetching logic inside UI components — use hooks from `epics` or server actions from `core`
- Ignoring responsive breakpoints: `sm` (640px), `md` (768px), `lg` (1024px), `xl` (1280px)
- Forgetting accessibility: Radix primitives handle ARIA, but custom components need manual attention
