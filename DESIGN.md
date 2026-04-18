# Design system

A reference for anyone (me included) building or editing tools in this
repo. Keep the site coherent so ten calculators feel like one site.

## Principles

**Text-forward.** Data first, chrome last. No hero sections, no stock
illustrations, no marketing copy. A tool should read like a well-typeset
form and table, not a landing page.

**One accent colour.** Teal `#7ae2cf` on dark, `#5dd4c4` on light.
Semantic warning, danger, and success colours exist but are used
sparingly — only when a value crosses a meaningful threshold. The
accent never competes with itself: two accent colours in one view is a
bug.

**Monospace-only typography.** SF Mono stack. Numbers and prose share
the same face. It is deliberately austere and it is the site's identity.
Do not introduce a sans or serif body face "for contrast".

**Hairline borders, flat fills.** 1 px borders on `--border`, slightly
darker on hover. No drop shadows. No gradients. No glassmorphism. No
card hover-lift transforms. Hover changes border, not elevation.

**Minimum viable chart.** Tufte rules: thin axis lines, gridlines only
when strictly required for reading values, no filled areas under lines,
no chart titles in-image (use the HTML heading above the chart),
tabular-aligned numeric labels.

## Tokens

Defined in `/assets/tools.css` as CSS custom properties.

### Surface scale

| Token | Dark | Light | Use |
|-------|------|-------|-----|
| `--bg` | `#000` | `#fff` | Page background |
| `--surface` | `#0a0a0a` | `#fafafa` | Inputs, buttons, chart panels |
| `--card` | `#141414` | `#f5f5f5` | Cards that sit above surface |
| `--border` | `#262626` | `#e5e5e5` | Default border |
| `--border-strong` | `#333` | `#d4d4d4` | Hover / focus border |

### Text scale

| Token | Use |
|-------|-----|
| `--text` | Primary body and numeric output |
| `--text-2` | Secondary copy, labels next to values |
| `--text-3` | Tertiary, meta, axis labels, placeholders |

### Accent and semantic

| Token | Meaning |
|-------|---------|
| `--accent` | Primary brand / interactive |
| `--accent-hover` | Hover or pressed accent |
| `--warn` | Cautionary signal (muted amber) |
| `--danger` | Threshold crossed (muted red) |
| `--ok` | Target met (muted sage) |

All semantic colours are desaturated so they do not fight the teal.

### Spacing — 4 px base unit

`--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 ·
`--s-6` 32 · `--s-7` 48 · `--s-8` 64.

### Radii

`--r-sm` 6 px (inputs, small buttons) · `--r-md` 10 px (cards).
Never larger. No pill buttons.

### Type scale

`--t-12` · `--t-13` · `--t-14` · `--t-16` · `--t-20` · `--t-28`.
Weights 400 (default) and 500 (labels, table headers). No 700, no
italics, no underlines except on hovered links.

### Motion

One transition: 150 ms `cubic-bezier(0.4, 0, 0.2, 1)`. Applied to
`background-color`, `border-color`, and `color`. Never to `transform`
or `box-shadow`. No bouncy easings, no page-load fade-ins.

## Component patterns

Every pattern below has a matching class in `/assets/tools.css` and,
where needed, a helper in `/assets/tools.js`.

### Page shell (`.tool-shell`, `.tool-header`)

Header has a back link, the tool title (`<h1>`), and a one-sentence
subtitle. Theme toggle is fixed top-right, not part of the header flow.
Main content in a single column, max-width 720 px (880 for chart-heavy
tools via `.tool-shell--wide`). Footer is a hairline rule with a small
link back to the index and the colophon.

### Input row (`.input-row`, `.field`, `.input-grid`)

Label above, input below, optional helper/error below that. Labels are
12 px uppercase, letter-spaced. Inputs are 14 px, full-width, with
1 px border on `--border`, radius 6 px. Focus state changes border to
`--accent` — no shadow, no glow, no ring.

### Segmented control (`.segmented`, `.segmented__btn`)

Two-or-three-way pressed-state toggle. Buttons sit inside a rounded
container with internal dividers. Active button: `--accent` fill, black
text. Used for mode switches (e.g. "two groups" vs "pre-post"), unit
choices, or paste/CSV modes.

### Result card (`.result-card`, `.result-row`)

`.result-card` for compact grids of many values. Label in 12 px
`--text-3`, value in 20 px `--accent`. Use `.result-row` for vertically
stacked flat rows (label left, value right).

### Data table (`.data-table`)

Header row in 12 px `--text-3`. Hairline row dividers only. No zebra
stripes. Right-align numeric columns with `.num` and use
`font-variant-numeric: tabular-nums` so digits line up. Active / matched
row uses `tr.is-active` with a 10 %-opacity accent tint.

### Callout (`.callout`, `.callout--warn/--danger/--ok`)

A single 2 px left border in the semantic colour, text in `--text-2`,
no background tint, no icon, no title. One or two sentences of plain
text.

### Chart (`.chart`, hand-rolled SVG via `Tools.chart.*`)

Fixed 16:9 aspect ratio inside a thin `--border`. Axis lines 1 px
`--border-strong`. Gridlines 1 px `--border` dashed. Series stroke
1.5 px `--accent` for primary, `--text-2` dashed for secondary.
Bands (ACWR zones, SWC) at 8–10 % opacity of their semantic colour.
Dots 3.5 px filled accent. No legends inside the chart — put them as
plain text above or below. No tooltips in v1.

### Download CSV button (`.btn-download`)

Small text button below any data table or chart. Standard label:
"Download CSV". Hooks to `Tools.csv.download(filename, data)`. Present
by default on every tool that produces a table or a computed series.

### Method section (`.method`, `<details>`)

A collapsible `<details>` at the bottom of every tool. Contains:
short equations in `<pre>`, a bulleted list of references, and
citations for thresholds or defaults. This is where the tool justifies
its choices — put arguments here, keep the main view clean.

## Anti-patterns

Do not do any of these, no matter how tempting.

- Centred hero sections with oversized CTAs.
- Drop shadows, gradients, or glassmorphism.
- Multiple accent colours in the same view.
- Emoji decoration beyond the single category icon on the landing
  page.
- Animated number counters, confetti, celebrations.
- "Powered by AI" / "Pro tip" callout boxes.
- Sans-serif body copy breaking the monospace identity.
- Tooltips used to hide primary information — if it matters, put it on
  the page.
- Chart legends, titles, or background fills inside the SVG.
- Vertical text inside tables.
- `text-align: center` on body copy.

## Building a new tool

1. Duplicate `/assets/_tool-template.html` to
   `/my-new-tool.html`.
2. Fill in the `<title>`, `<h1>`, and subtitle.
3. Use the documented classes. If you reach for a new class, ask
   whether an existing one covers it.
4. Use the shared helpers: `Tools.csv.parse`, `Tools.chart.line`,
   `Tools.stats.ewma`, etc. Do not reinvent them per-tool.
5. Wire a Download CSV button if the tool outputs a table or series.
6. Add a `<details class="method">` with the equations and references.
7. Add a card to `/index.html` in the right category.
8. Test in dark, light, and system themes, at 1280 px and 375 px
   widths.
