import assert = require("node:assert/strict");

import { buildIntersectionTooltip, buildSelectionOverlapTooltip, buildSetTooltip } from "../src/tooltip";
import { DisplayedVisualData, IntersectionDatum, ResolvedSettings, SelectionId, SetDatum } from "../src/contracts";

function createSelectionId(key: string): SelectionId {
    return {
        equals: (other) => other.getKey() === key,
        includes: (other) => other.getKey() === key,
        getKey: () => key,
        getSelector: () => ({}),
        getSelectorsByColumn: () => ({}),
        hasIdentity: () => true,
    } as SelectionId;
}

const settings: ResolvedSettings = {
    intersectionMode: "inclusive",
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
    showPercentages: true,
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
};

const intersection: IntersectionDatum = {
    id: "mask-3",
    mask: 3,
    count: 42,
    highlightCount: 18,
    degree: 2,
    activeSetIndexes: [0, 1],
    label: "Set A & Set B",
    sortMetric: 5,
    rowCount: 1,
    selectionIds: [createSelectionId("row-1")],
    selectionKeys: ["row-1"],
    primarySelectionId: createSelectionId("row-1"),
};

const setDatum: SetDatum = {
    id: "set-0",
    setIndex: 0,
    name: "Set A",
    size: 75,
    highlightSize: 24,
    selectionIds: [createSelectionId("row-1"), createSelectionId("row-2")],
    selectionKeys: ["row-1", "row-2"],
    primarySelectionId: null,
};

const data: DisplayedVisualData = {
    status: "ready",
    totalCount: 100,
    totalHighlightCount: 24,
    hasHighlights: true,
    validRowCount: 3,
    skippedRowCount: 0,
    setColumns: [
        { setIndex: 0, sourceIndex: 0, displayName: "Set A", bit: 1 },
        { setIndex: 1, sourceIndex: 1, displayName: "Set B", bit: 2 },
        { setIndex: 2, sourceIndex: 2, displayName: "Set C", bit: 4 },
    ],
    sets: [setDatum],
    allIntersections: [intersection],
    displayedIntersections: [intersection],
    hiddenEligibleIntersectionCount: 0,
};

type RunCase = (name: string, testCase: () => void) => void;

export function runTooltipTests(run: RunCase): void {
    run("intersection tooltip explains inclusive mode", () => {
        const tooltip = buildIntersectionTooltip(intersection, data, settings);

        assert.equal(tooltip[0].value, "Set A & Set B");
        assert.equal(tooltip[1].value, "42");
        assert.equal(tooltip[3].value, "Set A, Set B");
        assert.equal(tooltip[4].value, "Includes rows where these active sets are 1, even if other sets are also 1");
        assert.equal(tooltip[7].displayName, "Ignored sets");
        assert.equal(tooltip[7].value, "Set C");
        assert.equal(tooltip[5].displayName, "Highlighted");
    });

    run("intersection tooltip explains exact mode", () => {
        const tooltip = buildIntersectionTooltip(intersection, data, {
            ...settings,
            intersectionMode: "exact",
        });

        assert.equal(tooltip[4].value, "Includes only rows where active sets are 1 and inactive sets are 0");
        assert.equal(tooltip[7].displayName, "Inactive sets");
    });

    run("set tooltip includes size and share of total", () => {
        const tooltip = buildSetTooltip(setDatum, data, settings);

        assert.equal(tooltip[0].value, "Set A");
        assert.equal(tooltip[1].value, "75");
        assert.equal(tooltip[2].value, "75%");
        assert.equal(tooltip[3].value, "24");
    });

    run("selection overlap tooltip shows overlap metrics", () => {
        const tooltip = buildSelectionOverlapTooltip(
            intersection,
            {
                ...data,
                allIntersections: [
                    {
                        ...intersection,
                        mask: 3,
                        count: 42,
                        highlightCount: 18,
                    },
                    {
                        ...intersection,
                        id: "mask-1",
                        mask: 1,
                        count: 8,
                        highlightCount: 6,
                        activeSetIndexes: [0],
                        label: "Set A",
                    },
                ],
            },
            settings,
            new Set(["mask-3"]),
        );

        assert.equal(tooltip[0].displayName, "Overlap with selection");
        assert.equal(tooltip[0].value, "42");
    });
}
