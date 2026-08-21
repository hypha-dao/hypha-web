### React Component Design

#### Stack

- **React 19** with Server Components by default, `'use client'` for interactive components
- **UI primitives:** shadcn/ui built on Radix UI (accessible, composable headless components)
- **Icons:** Lucide React (primary), FontAwesome, Radix Icons
- **Rich text:** TipTap editor with MDX support
- **Forms:** react-hook-form + Zod validation
- **File uploads:** UploadThing with avatar, lead image, and attachment components

#### Atomic Design Hierarchy

| Level         | Package                 | Location         | Examples                                                          |
| ------------- | ----------------------- | ---------------- | ----------------------------------------------------------------- |
| **Atoms**     | `@hypha-platform/ui`    | `src/atoms/`     | `Logo`, `Heading`                                                 |
| **Molecules** | `@hypha-platform/ui`    | `src/molecules/` | `BadgesList`, `LoadingBackdrop`, `Markdown`                       |
| **Organisms** | `@hypha-platform/ui`    | `src/organisms/` | `Editor`, `MenuTop`, `Footer`, `SectionFilter`, `Tabs`            |
| **Features**  | `@hypha-platform/epics` | `src/{domain}/`  | Domain-specific: `governance/`, `treasury/`, `spaces/`, `people/` |

#### Component Conventions

- Destructure props in function signature
- Use `cn()` from `@hypha-platform/ui-utils` for className composition (clsx + tailwind-merge)
- Server-only components exported via `@hypha-platform/ui/server`
- Feature components in `epics` are domain-organized with co-located hooks
- Storybook stories use `.stories.tsx` suffix, co-located with components
