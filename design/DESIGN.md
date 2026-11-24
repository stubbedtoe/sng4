# GLITCH.SYS — Design System

Retro brutalism with a modern, glitch-art edge. Hard borders, hard offset shadows, neon interference — set in a high-contrast serif (Oranienbaum) over terminal-grade monospace (Space Mono). Built for rich applications: sliders, checkboxes, inputs, drawers, drag-and-drop.

All tokens below map 1:1 to CSS variables (e.g. `surface.canvas` → `--surface-canvas`). Every semantic token ships with light and dark values.

## Design Principles

1. **Borders before shadows.** Every interactive element gets a solid 2px ink border. Depth comes from hard offset shadows, never blurs.
2. **No rounded corners, no gradients.** The pixel grid is the geometry. Square corners everywhere.
3. **Glitch is an accent, not a texture.** RGB channel splits (magenta + cyan offsets) appear on display text and key brand moments only.
4. **Neon on paper, lime on night.** Light mode is warm paper with ink; dark mode is near-black with lime hard shadows.
5. **Serif for voice, mono for work.** Oranienbaum carries headings and brand; Space Mono carries all functional UI copy.

## Colors

### Base palette

| Token | Hex | Notes |
|---|---|---|
| `base.ink` | `#0B0B0F` | Near-black, primary ink |
| `base.paper` | `#F2EFE4` | Warm paper |
| `base.white` | `#FFFFFF` | Panels in light mode |
| `base.gray.900` | `#1C1C22` | |
| `base.gray.700` | `#3A3A42` | |
| `base.gray.500` | `#6B6B72` | Muted text |
| `base.gray.300` | `#B9B9AE` | Muted text (dark) |
| `base.gray.100` | `#E3E0D2` | Sunken surface |
| `base.blue` | `#2B4BFF` | Primary action |
| `base.blue.light` | `#6B7DFF` | Primary action (dark) |
| `base.magenta` | `#FF2E9E` | Glitch channel A |
| `base.cyan` | `#00D8D4` | Glitch channel B |
| `base.lime` | `#C8F542` | Highlight / dark-mode shadow |
| `base.red` | `#FF3B3B` | Danger |
| `base.yellow` | `#FFD32B` | Warning |

### Semantic tokens (light / dark)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `surface.canvas` | `#F2EFE4` | `#0D0D12` | Page background |
| `surface.panel` | `#FFFFFF` | `#17171E` | Cards, inputs, drawers |
| `surface.sunken` | `#E3E0D2` | `#0A0A0E` | Tracks, wells, drop targets |
| `surface.inverse` | `#0B0B0F` | `#F2EFE4` | Contrast fills (dark buttons, title bars) |
| `text.primary` | `#0B0B0F` | `#F2EFE4` | |
| `text.inverse` | `#F2EFE4` | `#0B0B0F` | Text on `surface.inverse` |
| `text.muted` | `#6B6B72` | `#B9B9AE` | Captions, metadata |
| `accent.primary` | `#2B4BFF` | `#6B7DFF` | Primary actions, focus rings, slider fills |
| `accent.secondary` | `#FF2E9E` | `#FF2E9E` | Glitch accent, carets |
| `accent.tertiary` | `#00D8D4` | `#00D8D4` | Glitch accent |
| `accent.highlight` | `#C8F542` | `#C8F542` | Checked/on states, tags |
| `status.danger` | `#FF3B3B` | `#FF3B3B` | Errors, destructive actions |
| `status.warning` | `#FFD32B` | `#FFD32B` | |
| `border.strong` | `#0B0B0F` | `#F2EFE4` | The default 2px border |
| `border.muted` | `#B9B9AE` | `#3A3A42` | Skeletons, inactive content |
| `overlay.scrim` | `#0B0B0F80` | `#00000099` | Behind drawers/modals |

Rules: text on lime, cyan, and paper surfaces is always `base.ink`; text on magenta, blue, and red is white. Dark mode never inverts the accent hues — only neutrals and shadows change.

## Typography

| Token | Font | Size / Line height | Usage |
|---|---|---|---|
| `text.display` | Oranienbaum | 44 / 125% | Hero titles (with glitch split) |
| `text.h1` | Oranienbaum | 30 / 130% | Page titles |
| `text.h2` | Oranienbaum | 18 / 140% | Section headers |
| `text.pixel` | Oranienbaum | 14 / 140% | Button labels, slider values |
| `text.label` | Space Mono | 13 / 140%, +2px tracking, uppercase | Field labels, nav, section meta |
| `text.body` | Space Mono | 16 / 150% | UI copy, input values |
| `text.caption` | Space Mono | 12 / 140% | Helper text, metadata (uses `text.muted`) |

Oranienbaum ships in a single weight — create hierarchy with size and tracking, not faux bold. Never use it below 14px.

## Spacing

4px base grid: `xs 4 · sm 8 · md 12 · lg 16 · xl 24 · 2xl 32 · 3xl 48`. Component padding and gaps use this scale only — no arbitrary values.

## Elevation & Stroke

| Token | Value | Usage |
|---|---|---|
| `shadow.brutal.sm` | offset (2,2), blur 0, ink / lime | Pressed buttons, slider thumbs |
| `shadow.brutal` | offset (4,4), ink / lime | Buttons, drag items (default) |
| `shadow.brutal.lg` | offset (8,8), ink / lime | Hover, dragging, drawers |
| `stroke.strong` | 2px `border.strong`, inside | Default border |
| `stroke.bold` | 3px `border.strong`, inside | Focus, drawers, emphasis |
| dash | 2px `accent.primary`, dashed | Drop targets only |

Shadow color flips ink → lime in dark mode — this is the signature dark-mode move. No blur, no spread, ever.

## Components

All components: square corners, 2px ink border, state changes affect only fill / border / shadow / opacity — never structure or layout-shifting size.

### Button
Height 48 (sm 36 / lg 56), padding-x 24, `text.pixel` label, `shadow.brutal`.
Tones: `primary` (blue, white text) · `dark` (inverse surface) · `outline` (panel fill) · `danger` (red).
States: hover → `shadow.brutal.lg`; pressed → `shadow.brutal.sm`; disabled → opacity 0.4.

### Checkbox
26px square box + `text.body` label, 12px gap. Unchecked: panel fill. Checked: lime fill + 3px ink checkmark. Indeterminate: magenta fill + 12×4 panel dash. Disabled: opacity 0.4.

### Toggle
60×32 track, 22px square knob (always `base.ink`), 3px track padding. Off: sunken track, knob left. On: lime track, knob right. Disabled: opacity 0.4.

### Tag
Padding 4×12, `text.label` at 12px, ink text. Tones: lime (default) · magenta (white text) · cyan · dark · outline.

### Input
Label (`text.label`) above a 52px field, panel fill. Focus: `stroke.bold` + `shadow.brutal` + magenta 10×22 caret. Error: 3px red border + red caption message below. Disabled: opacity 0.4.

### Slider
Header row: `text.label` left, `text.pixel` value right (accent color). Track: full-width 28px box, 4px inner padding; fill bar 20px; thumb 26px panel square with `stroke.strong` + `shadow.brutal.sm`. Tones: blue (default) · magenta · lime. Progress is a fill-width percentage — drive it from state. Disabled: opacity 0.4.

### Drag Item
Row: 2×4 dot grip (4px squares) + title (`text.body`) + meta (`text.caption`). Default: panel fill, `shadow.brutal`. Dragging: rotation −2°, `stroke.bold`, `shadow.brutal.lg`. Drop target: sunken fill, dashed primary border, content at 35% opacity, no shadow.

### Drawer
400px wide, full-height panel; 3px border + `shadow.brutal.lg`. Header: `text.h2` title + 32px close button; 3px divider bars above and below the scrollable body (24px padding, 16px gaps); footer with right-aligned sm buttons (RESET outline, APPLY primary). Always renders over `overlay.scrim`.

## Guidelines

**Do**
- Compose screens from semantic tokens only; base palette is for building semantic tokens.
- Use the glitch RGB split (magenta −6/+8, cyan +12/0, main +6/+4) on display-sized serif text.
- Keep movement upward on hover (shadow grows); press collapses the shadow.
- Pair every interactive element with a visible focus state (bold stroke + shadow).

**Don't**
- No border radius, no blurred shadows, no gradients on components.
- No accent-on-accent color mixing (e.g. magenta text on lime).
- No icons for decoration — icons only identify actions, navigation, or state.
- Don't dim siblings on hover; only the hovered element changes.

**Voice**
Copy reads like terminal output: short, declarative, slightly playful but functional. Labels in uppercase mono ("HANDLE", "SCANLINES"). Error messages state the problem and the consequence ("Wrong key. 2 attempts left.").
