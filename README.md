# Easy UpSet Plot

Easy UpSet Plot is an open-source Power BI custom visual for exploring set intersections in pre-aggregated data. It is built for Power BI Desktop and Power BI Service with a canvas-first renderer, low DOM count, native selection support, and native highlight-data support.

## Install In Power BI

End users do not need Node.js, npm, or any terminal commands.

1. Download the packaged `.pbiviz` file from the latest release or from the local `dist/` folder.
2. Open Power BI Desktop.
3. In the Visualizations pane, choose `...`.
4. Select `Import a visual from a file`.
5. Pick the `.pbiviz` file.

That is the normal install path for report authors and consumers.

## Build From Source

These steps are only for contributors or maintainers who want to rebuild the visual package locally.

Prerequisites:

- Node.js 24+
- npm
- Power BI Desktop

Commands:

- `npm install`
- `npm run check`
- `npm run package`

The importable visual package is written to `dist/`.

## Features

- Canvas-rendered UpSet layout:
  - top bar chart for intersection sizes
  - left bar chart for set sizes
  - matrix dots and connector lines
- Two intersection modes:
  - `Exact (true / false)`: classical UpSet semantics
  - `Inclusive (require / ignore)`: active dots required, inactive dots ignored
- Native Power BI selection, context menu, keyboard focus, and highlight-data rendering
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

## Project Layout

- `src/visual.ts`
- `src/dataConversion.ts`
- `src/rendering.ts`
- `src/settings.ts`
- `capabilities.json`
- `pbiviz.json`
- `docs/APPSOURCE_SUBMISSION.md`

## Sample Data

- `sample-data/small-preaggregated.csv`
- `sample-data/edge-cases.csv`
- `sample-data/generate-large-sample.mjs`
- [Demo data table](./docs/DEMO_DATA.md)

## Known Limitations

- Optimized for pre-aggregated mode, not raw element mode
- Maximum 20 set columns
- Synthetic `Other` buckets do not map to a single row identity
- The internal visual GUID remains stable as `fastUpsetPlot...` so existing imported reports can upgrade cleanly

## AppSource Readiness

This repository includes a submission checklist and starter docs for marketplace publication:

- [AppSource submission checklist](./docs/APPSOURCE_SUBMISSION.md)
- [Partner Center listing text](./docs/PARTNER_CENTER_LISTING.md)
- [Privacy policy template](./docs/PRIVACY.md)
- [EULA template](./docs/EULA.md)

For Microsoft guidance, see:

- [Publish Power BI visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/office-store)
- [Guidelines for publishing Power BI visuals](https://learn.microsoft.com/power-bi/developer/visuals/guidelines-powerbi-visuals)
- [Highlight data in Power BI custom visuals](https://learn.microsoft.com/en-us/power-bi/developer/visuals/highlight)

## License

MIT
