# Gits — Design System

> **Brand:** Gits
> **Tagline:** Get Into The Search

## 1. Design Direction

Gits should feel like a focused research utility rather than an "AI product".

The visual language should be:

- clean
- compact
- calm
- functional
- slightly playful through the penguin identity
- technical enough for power users without feeling like a developer-only tool

Avoid the common visual tropes of AI products: excessive gradients, glowing borders, glassmorphism, neon-on-black decoration, and ornamental animation that does not help the research workflow.

The mint color is the main brand signal. Everything else should stay mostly neutral so progress, qualification, and actions remain easy to scan.

## 2. Logo Direction

The Gits mark combines:

- a penguin head
- a magnifying glass
- mint green as the identifying color

The logo can be used without the wordmark inside the browser extension when space is limited.

Primary brand mint:

```text
#51F0A8
```

Do not recolor the magnifying glass with unrelated accent colors in the primary product experience.

## 3. Core Color Palette

The original mint theme contains many framework-oriented tokens. Gits only needs the colors that materially support the extension UI.

### Light Theme

| Role | Token | Value |
|---|---|---|
| Brand / primary | `--primary` | `#51f0a8` |
| Background | `--background` | `#fdfdfd` |
| Foreground | `--foreground` | `#000000` |
| Surface | `--surface` | `#fcfcfc` |
| Subtle surface | `--secondary` | `#fcfdfd` |
| Mint-tinted surface | `--accent` | `#f9fffc` |
| Muted surface | `--muted` | `#f5f5f5` |
| Input surface | `--input` | `#ebebeb` |
| Border | `--border` | `#f4f6f8` |
| Muted text | `--muted-foreground` | `#525252` |
| Mint-emphasis text | `--accent-foreground` | `#0d9f5d` |
| Danger | `--destructive` | `#f54a88` |
| Success support | `--success` | `#7efe8f` |
| Info | `--info` | `#2ebdf6` |
| Warning | `--warning` | `#ffb188` |
| Critical support | `--critical` | `#ff4838` |

### Dark Theme

| Role | Token | Value |
|---|---|---|
| Brand / primary | `--primary` | `#51f0a8` |
| Background | `--background` | `#000000` |
| Foreground | `--foreground` | `#f0f0f0` |
| Surface | `--surface` | `#0a0a0a` |
| Elevated surface | `--surface-elevated` | `#1a1b1b` |
| Secondary | `--secondary` | `#216a49` |
| Mint-tinted surface | `--accent` | `#093723` |
| Muted surface | `--muted` | `#252527` |
| Input surface | `--input` | `#3b3b3b` |
| Border | `--border` | `#19191a` |
| Muted text | `--muted-foreground` | `#969696` |
| Danger | `--destructive` | `#ff78a5` |
| Success support | `--success` | `#9effa1` |
| Info | `--info` | `#5fd0ff` |
| Warning | `--warning` | `#ffb188` |
| Mint support | `--mint-deep` | `#00331b` |

## 4. Clean Color Tokens

This is the recommended reduced CSS palette for Gits.

```css
:root {
  --primary: #51f0a8;
  --background: #fdfdfd;
  --foreground: #000000;

  --surface: #fcfcfc;
  --secondary: #fcfdfd;
  --accent: #f9fffc;
  --muted: #f5f5f5;
  --input: #ebebeb;
  --border: #f4f6f8;

  --muted-foreground: #525252;
  --accent-foreground: #0d9f5d;

  --success: #7efe8f;
  --info: #2ebdf6;
  --warning: #ffb188;
  --critical: #ff4838;
  --destructive: #f54a88;
}

.dark {
  --primary: #51f0a8;
  --background: #000000;
  --foreground: #f0f0f0;

  --surface: #0a0a0a;
  --surface-elevated: #1a1b1b;
  --secondary: #216a49;
  --accent: #093723;
  --muted: #252527;
  --input: #3b3b3b;
  --border: #19191a;

  --muted-foreground: #969696;

  --success: #9effa1;
  --info: #5fd0ff;
  --warning: #ffb188;
  --destructive: #ff78a5;
  --mint-deep: #00331b;
}
```

## 5. Tokens Intentionally Removed

The following source tokens should not be carried into the Gits color foundation unless a later component specifically needs them:

- `--radius`
- `--spacing`
- font-family variables
- shadow blur / offset / spread / opacity variables
- letter-spacing variable
- all sidebar-specific tokens
- duplicated foreground tokens such as card/popover/sidebar foreground variants
- `@theme inline` aliases
- chart token naming

The useful chart colors were retained only where they have a product-semantic role such as success, info, warning, or critical state.

## 6. Color Usage Rules

### Primary Mint

`#51f0a8` is the product identity color and should be reserved for:

- primary actions
- active controls
- progress emphasis
- connected / ready states when appropriate
- key Jev-related highlights
- focused input rings

Do not use mint on every container. The interface should remain mostly neutral so mint continues to signal importance.

### Background & Surfaces

Use the background token for the extension canvas. Use `surface`, `secondary`, `accent`, and `muted` to create hierarchy through small tonal differences instead of shadows.

Prefer borders and surface contrast over heavy elevation effects.

### Status Colors

Recommended semantic use:

- `success`: completed, saved, connected
- `info`: neutral informational state
- `warning`: review-required or partial result
- `critical`: hard failure or blocked automation state
- `destructive`: destructive user action such as remove key or stop-and-discard

Lead priority should not automatically map to red/yellow/green if that makes "low priority" look like an error. Priority is a ranking signal, not system health.

## 7. Typography

Typography is intentionally not dictated by the source CSS palette.

The implementation may keep the project's chosen UI font, but typography should remain:

- highly legible at browser-extension sizes
- compact without feeling cramped
- consistent across labels, values, and activity rows

Avoid using multiple decorative typefaces in the popup.

## 8. Components

This document does not define a popup wireframe. Existing product designs remain the source of truth for layout.

Components should apply the palette consistently across:

- API-key connection state
- search configuration controls
- research activity state
- lead cards / rows
- progress indicators
- pause / stop controls
- completion state
- CSV export
- settings

## 9. Interaction States

Every interactive control should have visually distinct:

- default
- hover
- focus
- active
- disabled
- loading states

Focus should use the mint primary color whenever practical.

Do not rely on color alone for status. Pair important statuses with text, icons, or labels.

## 10. Jev Visual Language

Jev should feel like part of the product's decision system rather than a chat assistant.

Prefer labels such as:

```text
Jev decision
Qualified
Skipped
Needs review
High priority
Confidence
```

Avoid chat bubbles, sparkle-heavy decorations, AI avatars, or generative-text metaphors unless a future feature actually introduces conversational AI.

## 11. Motion

Motion should only communicate state:

- research started
- candidate evaluation in progress
- progress updated
- research paused
- research completed

Keep transitions short and restrained. Avoid continuous decorative animation during long-running research sessions.

## 12. Accessibility

- Maintain readable text contrast in both themes.
- Do not use `#51f0a8` as body text on very light backgrounds without checking contrast.
- Use visible focus states for keyboard navigation.
- Pair status colors with labels or icons.
- Ensure interactive targets remain usable in the constrained browser-extension popup environment.

## 13. Implementation Principle

Treat the palette as semantic tokens, not fixed component colors.

For example:

```css
.button-primary {
  background: var(--primary);
  color: #000;
}

.panel {
  background: var(--surface);
  border-color: var(--border);
}

.helper-text {
  color: var(--muted-foreground);
}
```

This keeps the design adaptable without carrying over framework-specific CSS that Gits does not need.
