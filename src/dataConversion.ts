import powerbi from "powerbi-visuals-api";

import {
    DisplayedVisualData,
    IntersectionDatum,
    IntersectionMode,
    ParsedVisualData,
    PrimitiveValue,
    ResolvedSettings,
    SelectionId,
    SetColumnDescriptor,
    SetDatum,
    SortMode,
} from "./contracts";

type DataViewTable = powerbi.DataViewTable;
type DataViewMetadataColumn = powerbi.DataViewMetadataColumn;

interface MutableIntersectionBucket {
    mask: number;
    count: number;
    activeSetIndexes: number[];
    customLabel?: string;
    sortMetric: number | null;
    rowCount: number;
    selectionIds: SelectionId[];
    selectionKeys: string[];
}

interface RoleIndexes {
    setIndexes: number[];
    countIndex: number;
    labelIndex: number;
    sortMetricIndex: number;
}

export function coerceBinaryFlag(value: PrimitiveValue): 0 | 1 | null {
    if (value === null || value === undefined) {
        return null;
    }

    if (typeof value === "boolean") {
        return value ? 1 : 0;
    }

    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            return null;
        }

        if (value === 0) {
            return 0;
        }

        if (value === 1) {
            return 1;
        }

        return null;
    }

    if (typeof value === "string") {
        const trimmed = value.trim().toLowerCase();
        if (trimmed === "0" || trimmed === "false") {
            return 0;
        }

        if (trimmed === "1" || trimmed === "true") {
            return 1;
        }
    }

    return null;
}

export function coerceCount(value: PrimitiveValue): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        return null;
    }

    return numericValue;
}

export function parseTableData(
    table: DataViewTable | undefined,
    createSelectionId: (rowIndex: number) => SelectionId,
): ParsedVisualData {
    if (!table || !table.columns?.length || !table.rows?.length) {
        return {
            status: "empty",
            statusMessage: "Add one or more Set fields and a Count measure to render the UpSet plot.",
            totalCount: 0,
            validRowCount: 0,
            skippedRowCount: 0,
            countFormatString: undefined,
            sortMetricFormatString: undefined,
            setColumns: [],
            sets: [],
            allIntersections: [],
        };
    }

    const roleIndexes = detectRoleIndexes(table.columns);

    if (roleIndexes.countIndex < 0) {
        return {
            status: "invalid",
            statusMessage: "UpSet Criteria requires exactly one Count measure.",
            totalCount: 0,
            validRowCount: 0,
            skippedRowCount: 0,
            countFormatString: undefined,
            sortMetricFormatString: undefined,
            setColumns: [],
            sets: [],
            allIntersections: [],
        };
    }

    if (roleIndexes.setIndexes.length === 0) {
        return {
            status: "invalid",
            statusMessage: "UpSet Criteria requires at least one Set column containing 0/1 values.",
            totalCount: 0,
            validRowCount: 0,
            skippedRowCount: 0,
            countFormatString: undefined,
            sortMetricFormatString: undefined,
            setColumns: [],
            sets: [],
            allIntersections: [],
        };
    }

    if (roleIndexes.setIndexes.length > 20) {
        return {
            status: "invalid",
            statusMessage: "UpSet Criteria supports up to 20 Set columns in the current version.",
            totalCount: 0,
            validRowCount: 0,
            skippedRowCount: 0,
            countFormatString: undefined,
            sortMetricFormatString: undefined,
            setColumns: [],
            sets: [],
            allIntersections: [],
        };
    }

    const setColumns = buildSetColumns(table.columns, roleIndexes.setIndexes);
    const buckets = new Map<number, MutableIntersectionBucket>();
    let totalCount = 0;
    let validRowCount = 0;
    let skippedRowCount = 0;

    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex += 1) {
        const row = table.rows[rowIndex] as PrimitiveValue[];
        const count = coerceCount(row[roleIndexes.countIndex]);
        if (count === null) {
            skippedRowCount += 1;
            continue;
        }

        let mask = 0;
        const activeSetIndexes: number[] = [];
        let invalidSetValue = false;

        for (const setColumn of setColumns) {
            const setValue = coerceBinaryFlag(row[setColumn.sourceIndex]);
            if (setValue === null) {
                invalidSetValue = true;
                break;
            }

            if (setValue === 1) {
                mask |= setColumn.bit;
                activeSetIndexes.push(setColumn.setIndex);
            }
        }

        if (invalidSetValue) {
            skippedRowCount += 1;
            continue;
        }

        const selectionId = createSelectionId(rowIndex);
        const bucket = buckets.get(mask) ?? createBucket(mask, activeSetIndexes);
        bucket.count += count;
        bucket.rowCount += 1;
        bucket.selectionIds.push(selectionId);
        bucket.selectionKeys.push(selectionId.getKey());

        const customLabel = readLabel(row[roleIndexes.labelIndex]);
        if (customLabel && !bucket.customLabel) {
            bucket.customLabel = customLabel;
        }

        const sortMetric = readMetric(row[roleIndexes.sortMetricIndex]);
        if (sortMetric !== null) {
            bucket.sortMetric = (bucket.sortMetric ?? 0) + sortMetric;
        }

        if (!buckets.has(mask)) {
            buckets.set(mask, bucket);
        }

        totalCount += count;
        validRowCount += 1;
    }

    const allIntersections = Array.from(buckets.values()).map((bucket) => finalizeIntersection(bucket, setColumns));
    if (!allIntersections.length || totalCount <= 0) {
        return {
            status: "empty",
            statusMessage: skippedRowCount > 0
                ? "No valid non-zero combinations were found after coercing the incoming data."
                : "No non-zero combinations are available to render.",
            totalCount: 0,
            validRowCount,
            skippedRowCount,
            countFormatString: table.columns[roleIndexes.countIndex]?.format,
            sortMetricFormatString: roleIndexes.sortMetricIndex >= 0 ? table.columns[roleIndexes.sortMetricIndex]?.format : undefined,
            setColumns,
            sets: [],
            allIntersections: [],
        };
    }

    return {
        status: "ready",
        totalCount,
        validRowCount,
        skippedRowCount,
        countFormatString: table.columns[roleIndexes.countIndex]?.format,
        sortMetricFormatString: roleIndexes.sortMetricIndex >= 0 ? table.columns[roleIndexes.sortMetricIndex]?.format : undefined,
        setColumns,
        sets: buildSetData(setColumns, allIntersections),
        allIntersections,
    };
}

export function applyDisplaySettings(parsedData: ParsedVisualData, settings: ResolvedSettings): DisplayedVisualData {
    if (parsedData.status !== "ready") {
        return {
            ...parsedData,
            displayedIntersections: [],
            hiddenEligibleIntersectionCount: 0,
        };
    }

    const baseIntersections = settings.intersectionMode === "inclusive"
        ? buildRolledUpIntersections(parsedData.allIntersections, parsedData.setColumns)
        : parsedData.allIntersections.slice();
    const filteredBaseIntersections = settings.showEmptyIntersection
        ? baseIntersections
        : baseIntersections.filter((intersection) => intersection.mask !== 0);
    const sortedIntersections = sortIntersections(
        filteredBaseIntersections,
        parsedData.setColumns,
        settings.sortMode,
        settings.intersectionMode,
    );
    const eligibleIntersections = sortedIntersections.filter((intersection) => intersection.count >= settings.minimumCount);
    const displayedIntersections = eligibleIntersections.slice(0, settings.maxIntersections);
    const hiddenIntersections = eligibleIntersections.slice(settings.maxIntersections);

    if (settings.showOther && hiddenIntersections.length > 0) {
        displayedIntersections.push(createOtherBucket(hiddenIntersections));
    }

    return {
        ...parsedData,
        displayedIntersections,
        hiddenEligibleIntersectionCount: hiddenIntersections.length,
    };
}

export function sortIntersections(
    intersections: IntersectionDatum[],
    setColumns: SetColumnDescriptor[],
    sortMode: SortMode,
    intersectionMode: IntersectionMode,
): IntersectionDatum[] {
    const sorted = intersections.slice();
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

    sorted.sort((left, right) => {
        switch (sortMode) {
            case "lexical":
                return compareLexical(left, right, collator);
            case "degreeThenCount":
                return compareDegreeThenCount(left, right, collator);
            case "countDescending":
            default:
                return compareCountDescending(left, right, collator);
        }
    });

    return sorted.map((intersection) => {
        if (intersection.customLabel && !(intersectionMode === "inclusive" && intersection.mask === 0)) {
            return intersection;
        }

        return {
            ...intersection,
            label: buildMaskLabel(intersection.activeSetIndexes, setColumns, intersectionMode),
        };
    });
}

export function isDatumSelected(selectionKeys: string[], selectedKeys: Set<string>): boolean {
    if (!selectionKeys.length || selectedKeys.size === 0) {
        return false;
    }

    for (const key of selectionKeys) {
        if (selectedKeys.has(key)) {
            return true;
        }
    }

    return false;
}

function detectRoleIndexes(columns: DataViewMetadataColumn[]): RoleIndexes {
    const roleIndexes: RoleIndexes = {
        setIndexes: [],
        countIndex: -1,
        labelIndex: -1,
        sortMetricIndex: -1,
    };

    columns.forEach((column, index) => {
        if (column.roles?.set) {
            roleIndexes.setIndexes.push(index);
        }

        if (column.roles?.count && roleIndexes.countIndex < 0) {
            roleIndexes.countIndex = index;
        }

        if (column.roles?.label && roleIndexes.labelIndex < 0) {
            roleIndexes.labelIndex = index;
        }

        if (column.roles?.sortMetric && roleIndexes.sortMetricIndex < 0) {
            roleIndexes.sortMetricIndex = index;
        }
    });

    return roleIndexes;
}

function buildSetColumns(columns: DataViewMetadataColumn[], setIndexes: number[]): SetColumnDescriptor[] {
    return setIndexes.map((sourceIndex, setIndex) => ({
        setIndex,
        sourceIndex,
        displayName: columns[sourceIndex].displayName,
        queryName: columns[sourceIndex].queryName,
        bit: 1 << setIndex,
    }));
}

function createBucket(mask: number, activeSetIndexes: number[]): MutableIntersectionBucket {
    return {
        mask,
        count: 0,
        activeSetIndexes: activeSetIndexes.slice(),
        sortMetric: null,
        rowCount: 0,
        selectionIds: [],
        selectionKeys: [],
    };
}

function finalizeIntersection(bucket: MutableIntersectionBucket, setColumns: SetColumnDescriptor[]): IntersectionDatum {
    return {
        id: `mask-${bucket.mask}`,
        mask: bucket.mask,
        count: bucket.count,
        degree: bucket.activeSetIndexes.length,
        activeSetIndexes: bucket.activeSetIndexes.slice(),
        customLabel: bucket.customLabel,
        label: bucket.customLabel ?? buildMaskLabel(bucket.activeSetIndexes, setColumns, "exact"),
        sortMetric: bucket.sortMetric,
        rowCount: bucket.rowCount,
        selectionIds: bucket.selectionIds.slice(),
        selectionKeys: bucket.selectionKeys.slice(),
        primarySelectionId: bucket.selectionIds.length === 1 ? bucket.selectionIds[0] : null,
    };
}

function buildSetData(setColumns: SetColumnDescriptor[], intersections: IntersectionDatum[]): SetDatum[] {
    const sizes = new Array<number>(setColumns.length).fill(0);
    const selectionIdsBySet = setColumns.map(() => new Array<SelectionId>());
    const selectionKeysBySet = setColumns.map(() => new Array<string>());

    for (const intersection of intersections) {
        for (const activeSetIndex of intersection.activeSetIndexes) {
            sizes[activeSetIndex] += intersection.count;
            selectionIdsBySet[activeSetIndex].push(...intersection.selectionIds);
            selectionKeysBySet[activeSetIndex].push(...intersection.selectionKeys);
        }
    }

    return setColumns.map((setColumn) => ({
        id: `set-${setColumn.setIndex}`,
        setIndex: setColumn.setIndex,
        name: setColumn.displayName,
        size: sizes[setColumn.setIndex],
        selectionIds: selectionIdsBySet[setColumn.setIndex],
        selectionKeys: selectionKeysBySet[setColumn.setIndex],
        primarySelectionId: null,
    }));
}

function createOtherBucket(hiddenIntersections: IntersectionDatum[]): IntersectionDatum {
    return {
        id: "other",
        mask: -1,
        count: hiddenIntersections.reduce((sum, intersection) => sum + intersection.count, 0),
        degree: 0,
        activeSetIndexes: [],
        label: "Other",
        sortMetric: null,
        rowCount: hiddenIntersections.reduce((sum, intersection) => sum + intersection.rowCount, 0),
        selectionIds: [],
        selectionKeys: [],
        primarySelectionId: null,
        isOther: true,
        hiddenIntersectionCount: hiddenIntersections.length,
    };
}

function buildMaskLabel(
    activeSetIndexes: number[],
    setColumns: SetColumnDescriptor[],
    intersectionMode: IntersectionMode,
): string {
    if (!activeSetIndexes.length) {
        return intersectionMode === "inclusive" ? "Total" : "None";
    }

    return activeSetIndexes
        .map((index) => setColumns[index]?.displayName)
        .filter((value): value is string => Boolean(value))
        .join(" & ");
}

function buildRolledUpIntersections(
    exactIntersections: IntersectionDatum[],
    setColumns: SetColumnDescriptor[],
): IntersectionDatum[] {
    return exactIntersections.map((candidate) => {
        const matchingIntersections = exactIntersections.filter((intersection) => isSuperset(intersection.mask, candidate.mask));
        const selectionIds: SelectionId[] = [];
        const selectionKeys: string[] = [];
        let count = 0;
        let rowCount = 0;
        let sortMetric: number | null = null;

        for (const intersection of matchingIntersections) {
            count += intersection.count;
            rowCount += intersection.rowCount;
            selectionIds.push(...intersection.selectionIds);
            selectionKeys.push(...intersection.selectionKeys);
            if (intersection.sortMetric !== null) {
                sortMetric = (sortMetric ?? 0) + intersection.sortMetric;
            }
        }

        return {
            ...candidate,
            id: `rolled-${candidate.mask}`,
            count,
            rowCount,
            sortMetric,
            label: candidate.customLabel ?? buildMaskLabel(candidate.activeSetIndexes, setColumns, "inclusive"),
            selectionIds,
            selectionKeys,
            primarySelectionId: selectionIds.length === 1 ? selectionIds[0] : null,
        };
    });
}

function isSuperset(mask: number, subsetMask: number): boolean {
    return (mask & subsetMask) === subsetMask;
}

function readLabel(value: PrimitiveValue): string | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }

    const text = String(value).trim();
    return text.length > 0 ? text : undefined;
}

function readMetric(value: PrimitiveValue): number | null {
    if (value === null || value === undefined) {
        return null;
    }

    const metric = typeof value === "number" ? value : Number(value);
    return Number.isFinite(metric) ? metric : null;
}

function compareCountDescending(left: IntersectionDatum, right: IntersectionDatum, collator: Intl.Collator): number {
    return (right.count - left.count)
        || (right.degree - left.degree)
        || ((right.sortMetric ?? Number.NEGATIVE_INFINITY) - (left.sortMetric ?? Number.NEGATIVE_INFINITY))
        || collator.compare(left.label, right.label)
        || (left.mask - right.mask);
}

function compareDegreeThenCount(left: IntersectionDatum, right: IntersectionDatum, collator: Intl.Collator): number {
    return (right.degree - left.degree)
        || (right.count - left.count)
        || ((right.sortMetric ?? Number.NEGATIVE_INFINITY) - (left.sortMetric ?? Number.NEGATIVE_INFINITY))
        || collator.compare(left.label, right.label)
        || (left.mask - right.mask);
}

function compareLexical(left: IntersectionDatum, right: IntersectionDatum, collator: Intl.Collator): number {
    return collator.compare(left.label, right.label)
        || (right.count - left.count)
        || (right.degree - left.degree)
        || (left.mask - right.mask);
}
