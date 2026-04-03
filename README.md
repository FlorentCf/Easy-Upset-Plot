# UpSet Criteria

UpSet Criteria is an open-source Power BI custom visual for exploring set intersections in pre-aggregated data. It is optimized for performance in Power BI Desktop and Power BI Service with a canvas-first renderer, low DOM count, and native Power BI selection support.

## Why this visual

- Fast on pre-aggregated combination data
- Built for constrained browser sessions in Power BI Service
- Supports two intersection semantics
- Uses native Power BI selection, tooltips, context menu, and keyboard focus
- Includes a built-in guide for first-time users

## Features

- Canvas-rendered UpSet layout:
  - top bar chart for intersection sizes
  - left bar chart for set sizes
  - matrix dots and connector lines
- Two intersection modes:
  - `Exact (true / false)`: classical UpSet semantics
  - `Inclusive (require / ignore)`: active dots required, inactive dots ignored
- Selection-aware overlap tooltips
- Optional empty column:
  - `None` in Exact mode
  - `Total` in Inclusive mode
- Guide toggle and landing/onboarding state
- Modern Power BI formatting pane

## Data Contract

Primary mode is pre-aggregated. Each row is treated as one combination with one count.

Expected fields:

- `Set`: one or more 0/1 columns
- `Count`: required numeric measure
- `Label`: optional custom label
- `Sort Metric`: optional numeric tiebreaker

Accepted set values:

- numeric `0` / `1`
- boolean `false` / `true`

## Build

Prerequisites:

- Node.js 24+
- npm
- Power BI Desktop

Commands:

- `npm install`
- `npm run check`
- `npm run package`

The importable visual package is written to `dist/`.

## Import Into Power BI

1. Run `npm run package`
2. Open Power BI Desktop
3. In the Visualizations pane, choose `...`
4. Select `Import a visual from a file`
5. Pick the `.pbiviz` file from `dist/`

## Project Layout

- `src/visual.ts`
- `src/dataConversion.ts`
- `src/rendering.ts`
- `src/settings.ts`
- `capabilities.json`
- `pbiviz.json`

## Sample Data

- `sample-data/small-preaggregated.csv`
- `sample-data/edge-cases.csv`
- `sample-data/generate-large-sample.mjs`

## Known Limitations

- Optimized for pre-aggregated mode, not raw element mode
- Maximum 20 set columns
- Uses table mapping, so native Power BI highlight payload support is not implemented yet
- Synthetic `Other` buckets do not map to a single row identity

## Publish Readiness

This project is close to AppSource-ready, but before Microsoft marketplace submission you should still verify:

- final support/contact URLs
- final publisher assets and screenshots
- accessibility review in Power BI Desktop and Service
- certification expectations for native highlight support if you decide to pursue certified status

Relevant Microsoft guidance:

- [Publishing guidelines for Power BI custom visuals](https://learn.microsoft.com/power-bi/developer/visuals/guidelines-powerbi-visuals)
- [Visual interactions in Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/visuals-interactions)
- [Highlight data in Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/highlight)

## License

MIT
