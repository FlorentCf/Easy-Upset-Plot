# Demo Data

This example shows the recommended pre-aggregated input shape for Easy UpSet Plot.

Each row is one combination of binary conditions, and `Material Count` is the size of that exact combination.

Source file:

- `sample-data/small-preaggregated.csv`

## Demo Table

| FG based on UPN Type | FG based on Mapping | Is on MDM | Has Stock | Has GMC | Material Count | Label | Sort Metric |
| --- | --- | --- | --- | --- | ---: | --- | ---: |
| 1 | 1 | 1 | 0 | 1 | 148 | Core managed stock | 148 |
| 1 | 1 | 0 | 0 | 1 | 113 | Managed GMC only | 113 |
| 1 | 0 | 1 | 1 | 0 | 86 | UPN+MDM+Stock | 86 |
| 1 | 0 | 0 | 1 | 0 | 64 | UPN+Stock | 64 |
| 0 | 1 | 1 | 1 | 1 | 59 | Mapping managed stock GMC | 59 |
| 0 | 1 | 1 | 0 | 0 | 42 | Mapping and MDM | 42 |
| 0 | 0 | 1 | 1 | 0 | 31 | MDM+Stock | 31 |
| 0 | 0 | 1 | 0 | 1 | 22 | MDM+GMC | 22 |
| 0 | 0 | 0 | 1 | 1 | 18 | Stock+GMC | 18 |
| 0 | 0 | 0 | 0 | 0 | 11 | None | 11 |

## How To Read It

- Each `Set` column is a binary field (`0/1` or `false/true`)
- `Count` is the numeric size of that row's combination
- `Label` is optional and can override the generated combination label
- `Sort Metric` is optional and can be used as a tiebreaker in ordering

## Import Tip

If you want to demo the visual quickly in Power BI:

1. Load `sample-data/small-preaggregated.csv`
2. Add the binary columns to `Set`
3. Add `Material Count` to `Count`
4. Optionally add `Label` and `Sort Metric`
