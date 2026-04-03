import assert = require("node:assert/strict");

import powerbi from "powerbi-visuals-api";

import { applyDisplaySettings, coerceBinaryFlag, parseTableData } from "../src/dataConversion";
import { ResolvedSettings, SelectionId } from "../src/contracts";

function createSelectionId(rowIndex: number): SelectionId {
    const key = `row-${rowIndex}`;
    return {
        equals: (other) => other.getKey() === key,
        includes: (other) => other.getKey() === key,
        getKey: () => key,
        getSelector: () => ({}) as powerbi.data.Selector,
        getSelectorsByColumn: () => ({}) as powerbi.data.SelectorsByColumn,
        hasIdentity: () => true,
    } as SelectionId;
}

function createBaseSettings(overrides: Partial<ResolvedSettings> = {}): ResolvedSettings {
    return {
        intersectionMode: "exact",
        maxIntersections: 30,
        sortMode: "countDescending",
        minimumCount: 0,
        showOther: false,
        showEmptyIntersection: true,
        activeDotColor: "#0f7b6c",
        inactiveDotColor: "#d3d9e2",
        connectorColor: "#44546a",
        intersectionBarColor: "#1f5c99",
        setBarColor: "#3f7cac",
        selectedColor: "#f97316",
        backgroundColor: "#ffffff",
        dimmedOpacity: 0.25,
        showSetLabels: true,
        fontSize: 12,
        labelStrategy: "truncate",
        showBarCounts: true,
        countDisplayFormat: "standard",
        showPercentages: false,
        leftPanelWidth: 220,
        rowHeight: 26,
        columnWidth: 26,
        intersectionBarHeight: 120,
        dotRadius: 5,
        connectorThickness: 2,
        innerPadding: 12,
        enableSelection: true,
        showGuide: true,
        respectHighContrast: true,
        enableDebugLogging: false,
        locale: "en-US",
        textColor: "#111827",
        gridColor: "#d5dde7",
        isHighContrast: false,
        highContrastForeground: "#000000",
        highContrastBackground: "#ffffff",
        ...overrides,
    };
}

function createTable(rows: unknown[][]): powerbi.DataViewTable {
    return {
        columns: [
            { displayName: "Set A", roles: { set: true } },
            { displayName: "Set B", roles: { set: true } },
            { displayName: "Count", roles: { count: true } },
            { displayName: "Label", roles: { label: true } },
            { displayName: "Sort Metric", roles: { sortMetric: true } },
        ] as powerbi.DataViewMetadataColumn[],
        rows: rows as powerbi.PrimitiveValue[][],
    };
}

type RunCase = (name: string, testCase: () => void) => void;

export function runDataConversionTests(run: RunCase): void {
    run("coerceBinaryFlag accepts numeric and boolean flags", () => {
        assert.equal(coerceBinaryFlag(0), 0);
        assert.equal(coerceBinaryFlag(1), 1);
        assert.equal(coerceBinaryFlag(true), 1);
        assert.equal(coerceBinaryFlag(false), 0);
        assert.equal(coerceBinaryFlag("true"), 1);
        assert.equal(coerceBinaryFlag("0"), 0);
        assert.equal(coerceBinaryFlag(2), null);
    });

    run("parseTableData aggregates duplicate combinations and computes set sizes", () => {
        const parsed = parseTableData(
            createTable([
                [1, 0, 10, "A only", 2],
                [1, 0, 4, "Duplicate A", 1],
                [1, 1, 5, "A+B", 3],
                [0, 1, 7, "B only", 4],
            ]),
            createSelectionId,
        );

        assert.equal(parsed.status, "ready");
        assert.equal(parsed.totalCount, 26);
        assert.equal(parsed.allIntersections.length, 3);
        assert.equal(parsed.sets[0].size, 19);
        assert.equal(parsed.sets[1].size, 12);

        const aOnly = parsed.allIntersections.find((intersection) => intersection.mask === 1);
        assert.ok(aOnly);
        assert.equal(aOnly?.count, 14);
        assert.equal(aOnly?.selectionIds.length, 2);
    });

    run("parseTableData skips invalid count or set rows safely", () => {
        const parsed = parseTableData(
            createTable([
                [1, 0, 10, "valid", 1],
                [null, 1, 5, "invalid set", 1],
                [0, 1, 0, "zero count", 1],
                [1, 1, -3, "negative", 1],
            ]),
            createSelectionId,
        );

        assert.equal(parsed.status, "ready");
        assert.equal(parsed.validRowCount, 1);
        assert.equal(parsed.skippedRowCount, 3);
        assert.equal(parsed.totalCount, 10);
    });

    run("applyDisplaySettings supports exact mode sorting and truncation with Other bucket", () => {
        const parsed = parseTableData(
            createTable([
                [1, 0, 10, "A", 1],
                [0, 1, 9, "B", 1],
                [1, 1, 8, "AB", 1],
                [0, 0, 7, "None", 1],
            ]),
            createSelectionId,
        );

        const displayed = applyDisplaySettings(parsed, createBaseSettings({
            maxIntersections: 2,
            showOther: true,
        }));

        assert.equal(displayed.displayedIntersections.length, 3);
        assert.equal(displayed.displayedIntersections[0].count, 10);
        assert.equal(displayed.displayedIntersections[1].count, 9);
        assert.equal(displayed.displayedIntersections[2].isOther, true);
        assert.equal(displayed.displayedIntersections[2].count, 15);
        assert.equal(displayed.displayedIntersections[2].hiddenIntersectionCount, 2);
    });

    run("applyDisplaySettings supports inclusive mode with total scope and rolled-up counts", () => {
        const parsed = parseTableData(
            createTable([
                [1, 0, 10, "A", 1],
                [0, 1, 9, "B", 1],
                [1, 1, 8, "AB", 1],
                [0, 0, 7, "None", 1],
            ]),
            createSelectionId,
        );

        const displayed = applyDisplaySettings(parsed, createBaseSettings({
            intersectionMode: "inclusive",
            maxIntersections: 2,
            showOther: true,
        }));

        assert.equal(displayed.displayedIntersections.length, 3);
        assert.equal(displayed.displayedIntersections[0].label, "Total");
        assert.equal(displayed.displayedIntersections[0].count, 34);
        assert.equal(displayed.displayedIntersections[1].count, 18);
        assert.equal(displayed.displayedIntersections[2].isOther, true);
        assert.equal(displayed.displayedIntersections[2].count, 25);
        assert.equal(displayed.displayedIntersections[2].hiddenIntersectionCount, 2);
    });

    run("set selection mapping unions all matching combination identities", () => {
        const parsed = parseTableData(
            createTable([
                [1, 0, 10, "A", 1],
                [1, 1, 9, "AB", 1],
                [1, 0, 8, "A duplicate", 1],
                [0, 1, 7, "B", 1],
            ]),
            createSelectionId,
        );

        assert.deepEqual(
            parsed.sets[0].selectionKeys.slice().sort(),
            ["row-0", "row-1", "row-2"],
        );
    });

    run("applyDisplaySettings can hide the empty column in both modes", () => {
        const parsed = parseTableData(
            createTable([
                [1, 0, 10, "A", 1],
                [0, 0, 7, "None", 1],
            ]),
            createSelectionId,
        );

        const exactDisplayed = applyDisplaySettings(parsed, createBaseSettings({
            showEmptyIntersection: false,
        }));
        const inclusiveDisplayed = applyDisplaySettings(parsed, createBaseSettings({
            intersectionMode: "inclusive",
            showEmptyIntersection: false,
        }));

        assert.equal(exactDisplayed.displayedIntersections.some((intersection) => intersection.mask === 0), false);
        assert.equal(inclusiveDisplayed.displayedIntersections.some((intersection) => intersection.mask === 0), false);
    });
}
