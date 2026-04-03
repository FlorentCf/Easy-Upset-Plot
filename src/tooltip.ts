import { DisplayedVisualData, IntersectionDatum, IntersectionMode, ResolvedSettings, SetDatum, TooltipDataItem } from "./contracts";

interface SelectionPredicate {
    kind: "intersection" | "set";
    mask: number;
}

export function buildIntersectionTooltip(
    intersection: IntersectionDatum,
    data: DisplayedVisualData,
    settings: ResolvedSettings,
): TooltipDataItem[] {
    if (intersection.isOther) {
        return [
            {
                header: "Other intersections",
                displayName: "Bucket",
                value: "Other",
            },
            {
                displayName: "Combined count",
                value: formatCountValue(intersection.count, settings),
            },
            {
                displayName: "Hidden intersections",
                value: String(intersection.hiddenIntersectionCount ?? 0),
            },
        ];
    }

    const activeSetNames = intersection.activeSetIndexes
        .map((index) => data.setColumns[index]?.displayName)
        .filter((value): value is string => Boolean(value));
    const inactiveSetNames = data.setColumns
        .filter((setColumn) => !intersection.activeSetIndexes.includes(setColumn.setIndex))
        .map((setColumn) => setColumn.displayName);

    const tooltipItems: TooltipDataItem[] = [
        {
            header: intersection.label,
            displayName: "Combination",
            value: intersection.label,
        },
        {
            displayName: "Count",
            value: formatCountValue(intersection.count, settings, data.countFormatString),
        },
        {
            displayName: "Degree",
            value: String(intersection.degree),
        },
        {
            displayName: "Active sets",
            value: activeSetNames.length > 0
                ? activeSetNames.join(", ")
                : (settings.intersectionMode === "inclusive" ? "No required sets" : "None"),
        },
        {
            displayName: "Count logic",
            value: settings.intersectionMode === "inclusive"
                ? "Includes rows where these active sets are 1, even if other sets are also 1"
                : "Includes only rows where active sets are 1 and inactive sets are 0",
        },
    ];

    if (data.hasHighlights) {
        tooltipItems.push({
            displayName: "Highlighted",
            value: formatCountValue(intersection.highlightCount, settings, data.countFormatString),
        });
        tooltipItems.push({
            displayName: "Highlighted share",
            value: intersection.count > 0
                ? formatPercentValue(intersection.highlightCount / intersection.count, settings.locale)
                : "0%",
        });
    }

    if (inactiveSetNames.length > 0 && inactiveSetNames.length <= 8) {
        tooltipItems.push({
            displayName: settings.intersectionMode === "inclusive" ? "Ignored sets" : "Inactive sets",
            value: inactiveSetNames.join(", "),
        });
    }

    if (intersection.sortMetric !== null) {
        tooltipItems.push({
            displayName: "Sort metric",
            value: formatCountValue(intersection.sortMetric, { ...settings, countDisplayFormat: "standard" }, data.sortMetricFormatString),
        });
    }

    return tooltipItems;
}

export function buildSetTooltip(
    setDatum: SetDatum,
    data: DisplayedVisualData,
    settings: ResolvedSettings,
): TooltipDataItem[] {
    const tooltipItems: TooltipDataItem[] = [
        {
            header: setDatum.name,
            displayName: "Set",
            value: setDatum.name,
        },
        {
            displayName: "Size",
            value: formatCountValue(setDatum.size, settings, data.countFormatString),
        },
        {
            displayName: "Share of total",
            value: data.totalCount > 0 ? formatPercentValue(setDatum.size / data.totalCount, settings.locale) : "0%",
        },
    ];

    if (data.hasHighlights) {
        tooltipItems.push({
            displayName: "Highlighted",
            value: formatCountValue(setDatum.highlightSize, settings, data.countFormatString),
        });
        tooltipItems.push({
            displayName: "Highlighted share",
            value: setDatum.size > 0
                ? formatPercentValue(setDatum.highlightSize / setDatum.size, settings.locale)
                : "0%",
        });
    }

    return tooltipItems;
}

export function buildSelectionOverlapTooltip(
    target: IntersectionDatum | SetDatum,
    data: DisplayedVisualData,
    settings: ResolvedSettings,
    explicitSelectedDatumIds: Set<string>,
): TooltipDataItem[] {
    if (explicitSelectedDatumIds.size === 0) {
        return [];
    }

    const selectionPredicates = buildSelectionPredicates(data, explicitSelectedDatumIds);
    if (selectionPredicates.length === 0) {
        return [];
    }

    const targetPredicate = buildTargetPredicate(target);
    const targetCount = "setIndex" in target ? target.size : target.count;
    if (targetCount <= 0) {
        return [];
    }

    let overlapCount = 0;
    let selectionCount = 0;
    for (const exactIntersection of data.allIntersections) {
        const matchesSelection = matchesAnyPredicate(exactIntersection.mask, selectionPredicates, settings.intersectionMode);
        if (matchesSelection) {
            selectionCount += exactIntersection.count;
        }

        if (matchesSelection && matchesPredicate(exactIntersection.mask, targetPredicate, settings.intersectionMode)) {
            overlapCount += exactIntersection.count;
        }
    }

    if (selectionCount <= 0) {
        return [];
    }

    return [
        {
            displayName: "Overlap with selection",
            value: formatCountValue(overlapCount, settings, data.countFormatString),
        },
        {
            displayName: "Share of hovered item",
            value: formatPercentValue(overlapCount / targetCount, settings.locale),
        },
        {
            displayName: "Share of selection",
            value: formatPercentValue(overlapCount / selectionCount, settings.locale),
        },
    ];
}

export function formatCountValue(
    value: number,
    settings: Pick<ResolvedSettings, "countDisplayFormat" | "locale">,
    formatString?: string,
): string {
    if (settings.countDisplayFormat === "raw") {
        return Number.isInteger(value) ? String(value) : value.toFixed(2);
    }

    if (settings.countDisplayFormat === "standard" && formatString) {
        return formatWithPowerBiPattern(value, formatString, settings.locale);
    }

    const absoluteValue = Math.abs(value);
    const compactFractionDigits = absoluteValue >= 10000 ? 0 : 1;

    const formatter = new Intl.NumberFormat(settings.locale, {
        notation: settings.countDisplayFormat === "compact" ? "compact" : "standard",
        maximumFractionDigits: settings.countDisplayFormat === "compact" ? compactFractionDigits : 0,
    });

    return formatter.format(value);
}

export function formatPercentValue(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
        style: "percent",
        maximumFractionDigits: 1,
    }).format(value);
}

function formatWithPowerBiPattern(value: number, formatString: string, locale: string): string {
    const normalizedPattern = formatString.trim();
    if (!normalizedPattern) {
        return formatFallbackNumber(value, locale);
    }

    const firstSection = normalizedPattern.split(";")[0].trim();
    if (!firstSection) {
        return formatFallbackNumber(value, locale);
    }

    const isPercent = firstSection.includes("%");
    const decimalPart = firstSection.includes(".")
        ? firstSection.slice(firstSection.indexOf(".") + 1).replace(/[^0#]/g, "")
        : "";
    const minimumFractionDigits = (decimalPart.match(/0/g) ?? []).length;
    const maximumFractionDigits = decimalPart.length;
    const usesGrouping = firstSection.includes(",");
    const prefixMatch = firstSection.match(/^[^0#.,%]+/);
    const suffixMatch = firstSection.match(/[^0#.,%]+$/);
    const prefix = prefixMatch?.[0] ?? "";
    const suffix = suffixMatch?.[0] ?? "";

    const formattedNumber = new Intl.NumberFormat(locale, {
        style: isPercent ? "percent" : "decimal",
        useGrouping: usesGrouping,
        minimumFractionDigits,
        maximumFractionDigits,
    }).format(isPercent ? value : value);

    return `${prefix}${formattedNumber}${suffix}`.trim();
}

function formatFallbackNumber(value: number, locale: string): string {
    return new Intl.NumberFormat(locale, {
        notation: "standard",
        maximumFractionDigits: 0,
    }).format(value);
}

function buildSelectionPredicates(data: DisplayedVisualData, explicitSelectedDatumIds: Set<string>): SelectionPredicate[] {
    const predicates: SelectionPredicate[] = [];

    for (const intersection of data.displayedIntersections) {
        if (intersection.isOther || !explicitSelectedDatumIds.has(intersection.id)) {
            continue;
        }

        predicates.push({
            kind: "intersection",
            mask: intersection.mask,
        });
    }

    for (const setDatum of data.sets) {
        if (!explicitSelectedDatumIds.has(setDatum.id)) {
            continue;
        }

        predicates.push({
            kind: "set",
            mask: 1 << setDatum.setIndex,
        });
    }

    return predicates;
}

function buildTargetPredicate(target: IntersectionDatum | SetDatum): SelectionPredicate {
    if ("setIndex" in target) {
        return {
            kind: "set",
            mask: 1 << target.setIndex,
        };
    }

    return {
        kind: "intersection",
        mask: target.mask,
    };
}

function matchesAnyPredicate(mask: number, predicates: SelectionPredicate[], intersectionMode: IntersectionMode): boolean {
    for (const predicate of predicates) {
        if (matchesPredicate(mask, predicate, intersectionMode)) {
            return true;
        }
    }

    return false;
}

function matchesPredicate(mask: number, predicate: SelectionPredicate, intersectionMode: IntersectionMode): boolean {
    if (predicate.kind === "set") {
        return (mask & predicate.mask) !== 0;
    }

    return intersectionMode === "inclusive"
        ? (mask & predicate.mask) === predicate.mask
        : mask === predicate.mask;
}
