# Storybook + visual testing (Chromatic-ready)

When working in `next-template`:

- Any **visual/UI change** must be accompanied by **Storybook story creation or updates**.
- New UI work should be categorized as:
  - **Components**: `src/components/**` → add/update stories in `src/stories/components/**`
  - **Blocks**: compositional UI pieces (e.g. sections) → add/update stories in `src/stories/blocks/**`
  - **Views/Pages**: `src/views/**` (or page-level UI) → add/update stories in `src/stories/pages/**`
- Keep `pnpm run build-storybook` **green**; CI/Chromatic enforces it.

## Component primitives

- Prefer **shadcn/ui** primitives from `src/components/ui/**` and compose upward.
