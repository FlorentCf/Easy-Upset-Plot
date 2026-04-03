import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const outputPath = resolve("sample-data/generated/large-preaggregated.csv");
mkdirSync(dirname(outputPath), { recursive: true });

const setNames = [
  "FG based on UPN Type",
  "FG based on Mapping",
  "Is on MDM",
  "Has Stock",
  "Has GMC",
  "Sales Since 2024",
  "Has Warranty",
  "Is Critical",
];

const headers = [...setNames, "Material Count", "Label", "Sort Metric"];
const rows = [headers.join(",")];

for (let mask = 0; mask < 96; mask += 1) {
  const flags = setNames.map((_, index) => ((mask >> index) & 1));
  const degree = flags.reduce((sum, value) => sum + value, 0);
  const count = (degree + 1) * 13 + ((mask * 17) % 91);
  const label = degree === 0
    ? "None"
    : flags
      .map((value, index) => (value ? setNames[index] : null))
      .filter(Boolean)
      .join(" + ");

  rows.push([...flags, count, label, count].join(","));
}

writeFileSync(outputPath, `${rows.join("\n")}\n`, "utf8");
