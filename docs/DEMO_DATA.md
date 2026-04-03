# Demo Data

This example shows the recommended pre-aggregated input shape for Easy UpSet Plot.

Each row is one combination of binary conditions, and `Customer Count` is the size of that exact combination.

Source file:

- `sample-data/customer-segments-demo.csv`

## Demo Table

| Is Loyalty Member | Used Mobile App | Used Discount | Bought Premium | Repeat Customer | Customer Count | Label | Sort Metric |
| --- | --- | --- | --- | --- | ---: | --- | ---: |
| 1 | 1 | 1 | 1 | 1 | 182 | Power shoppers | 182 |
| 1 | 1 | 0 | 1 | 1 | 146 | Loyal premium app repeat | 146 |
| 1 | 0 | 1 | 0 | 1 | 121 | Loyal discount repeat | 121 |
| 0 | 1 | 1 | 0 | 0 | 98 | App bargain hunters | 98 |
| 1 | 1 | 1 | 0 | 1 | 93 | Loyal app discount repeat | 93 |
| 0 | 0 | 1 | 1 | 0 | 88 | Premium discount shoppers | 88 |
| 1 | 0 | 0 | 1 | 1 | 84 | Loyal premium repeat | 84 |
| 0 | 1 | 0 | 1 | 0 | 73 | Premium app shoppers | 73 |
| 1 | 1 | 0 | 0 | 0 | 67 | Loyal app only | 67 |
| 0 | 0 | 1 | 0 | 1 | 61 | Discount repeat | 61 |
| 0 | 1 | 0 | 0 | 1 | 52 | App repeat | 52 |
| 1 | 0 | 0 | 0 | 1 | 47 | Loyal repeat | 47 |
| 0 | 0 | 0 | 1 | 0 | 34 | Premium only | 34 |
| 0 | 0 | 0 | 0 | 0 | 26 | Baseline customers | 26 |

## How To Read It

- Each `Set` column is a binary field (`0/1` or `false/true`)
- `Count` is the numeric size of that row's combination
- `Label` is optional and can override the generated combination label
- `Sort Metric` is optional and can be used as a tiebreaker in ordering

## Import Tip

If you want to demo the visual quickly in Power BI:

1. Load `sample-data/customer-segments-demo.csv`
2. Add the binary columns to `Set`
3. Add `Customer Count` to `Count`
4. Optionally add `Label` and `Sort Metric`
