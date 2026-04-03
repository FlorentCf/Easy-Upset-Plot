import {
    DisplayedVisualData,
    IntersectionMode,
    Rect,
    RenderState,
    ResolvedSettings,
    RowLayout,
    UpSetLayout,
} from "./contracts";
import { isDatumSelected } from "./dataConversion";
import { formatCountValue, formatPercentValue } from "./tooltip";

const FONT_FAMILY = "\"Segoe UI\", wf_segoe-ui_normal, helvetica, arial, sans-serif";

interface InteractionContext {
    explicitSelectionActive: boolean;
    externalSelectionActive: boolean;
    nativeHighlightActive: boolean;
    explicitIntersectionIds: Set<string>;
    explicitSetIds: Set<string>;
    highlightedSetIndexes: Set<number>;
    setOverlapRatios: Map<number, number>;
    intersectionOverlapRatios: Map<string, number>;
    setHighlightRatios: Map<number, number>;
    intersectionHighlightRatios: Map<string, number>;
}

interface SelectionPredicate {
    kind: "intersection" | "set";
    mask: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

class TextMeasureCache {
    private readonly cache = new Map<string, number>();

    public measure(context: CanvasRenderingContext2D, text: string): number {
        const key = `${context.font}|${text}`;
        const cached = this.cache.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const width = context.measureText(text).width;
        this.cache.set(key, width);
        return width;
    }

    public clear(): void {
        this.cache.clear();
    }
}

export class CanvasRenderer {
    private readonly canvas: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D;
    private readonly textMeasureCache = new TextMeasureCache();
    private width = 0;
    private height = 0;
    private devicePixelRatio = 1;

    constructor(canvas: HTMLCanvasElement) {
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
            throw new Error("Easy UpSet Plot requires a 2D canvas context.");
        }

        this.canvas = canvas;
        this.context = context;
    }

    public resize(width: number, height: number): void {
        const nextDevicePixelRatio = globalThis.devicePixelRatio || 1;
        const resized = this.width !== width || this.height !== height || this.devicePixelRatio !== nextDevicePixelRatio;
        if (!resized) {
            return;
        }

        this.width = width;
        this.height = height;
        this.devicePixelRatio = nextDevicePixelRatio;
        this.canvas.width = Math.max(1, Math.floor(width * this.devicePixelRatio));
        this.canvas.height = Math.max(1, Math.floor(height * this.devicePixelRatio));
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.context.setTransform(this.devicePixelRatio, 0, 0, this.devicePixelRatio, 0, 0);
        this.textMeasureCache.clear();
    }

    public render(state: RenderState): void {
        const { data, layout, settings, selectedRowKeys, explicitSelectedDatumIds } = state;
        const interaction = buildInteractionContext(data, explicitSelectedDatumIds, selectedRowKeys, settings.intersectionMode);
        const context = this.context;

        context.save();
        context.clearRect(0, 0, layout.viewportWidth, layout.viewportHeight);
        context.fillStyle = settings.backgroundColor;
        context.fillRect(0, 0, layout.viewportWidth, layout.viewportHeight);

        if (data.status !== "ready") {
            this.drawStatusMessage(data.statusMessage ?? "No data available.", settings, layout);
            context.restore();
            return;
        }

        this.drawScaffolding(data, layout, settings, interaction);

        const maxIntersectionCount = Math.max(...data.displayedIntersections.map((intersection) => intersection.count), 1);
        const maxSetSize = Math.max(...data.sets.map((setDatum) => setDatum.size), 1);

        this.drawSetBars(data, layout, settings, selectedRowKeys, interaction, maxSetSize);
        this.drawIntersectionBars(data, layout, settings, selectedRowKeys, interaction, maxIntersectionCount);
        this.drawConnectorsAndDots(data, layout, settings, selectedRowKeys, interaction);
        context.restore();
    }

    private drawStatusMessage(message: string, settings: ResolvedSettings, layout: UpSetLayout): void {
        const context = this.context;
        context.fillStyle = settings.backgroundColor;
        context.fillRect(0, 0, layout.viewportWidth, layout.viewportHeight);
        context.fillStyle = settings.textColor;
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = `600 ${Math.max(12, settings.fontSize + 2)}px ${FONT_FAMILY}`;
        context.fillText("Easy UpSet Plot", layout.viewportWidth / 2, (layout.viewportHeight / 2) - 14);
        context.font = `400 ${Math.max(11, settings.fontSize)}px ${FONT_FAMILY}`;
        context.fillText(message, layout.viewportWidth / 2, (layout.viewportHeight / 2) + 12);
    }

    private drawScaffolding(
        data: DisplayedVisualData,
        layout: UpSetLayout,
        settings: ResolvedSettings,
        interaction: InteractionContext,
    ): void {
        const context = this.context;
        const rowBandRect: Rect = {
            x: layout.leftPanelRect.x,
            y: layout.leftPanelRect.y,
            width: layout.leftPanelRect.width + (layout.matrixRect.x + layout.matrixRect.width - layout.leftPanelRect.x),
            height: layout.leftPanelRect.height,
        };

        for (const rowLayout of layout.rowLayouts) {
            if (rowLayout.index % 2 === 1) {
                context.globalAlpha = 0.24;
                context.fillStyle = settings.gridColor;
                fillRoundedRect(context, {
                    x: rowBandRect.x,
                    y: rowLayout.y + 1,
                    width: rowBandRect.width,
                    height: Math.max(0, rowLayout.height - 2),
                }, 8);
            }

            if (interaction.highlightedSetIndexes.has(rowLayout.index)) {
                context.globalAlpha = interaction.explicitSelectionActive ? 0.09 : 0.06;
                context.fillStyle = settings.selectedColor;
                fillRoundedRect(context, {
                    x: rowBandRect.x,
                    y: rowLayout.y + 2,
                    width: rowBandRect.width,
                    height: Math.max(0, rowLayout.height - 4),
                }, 8);
            }

            if (!interaction.explicitSelectionActive && interaction.nativeHighlightActive) {
                const highlightRatio = interaction.setHighlightRatios.get(rowLayout.index) ?? 0;
                if (highlightRatio > 0) {
                    context.globalAlpha = 0.04 + (0.06 * highlightRatio);
                    context.fillStyle = settings.selectedColor;
                    fillRoundedRect(context, {
                        x: rowBandRect.x,
                        y: rowLayout.y + 2,
                        width: rowBandRect.width,
                        height: Math.max(0, rowLayout.height - 4),
                    }, 8);
                }
            }
        }

        for (const columnLayout of layout.columnLayouts) {
            const intersection = data.displayedIntersections[columnLayout.index];
            if (!intersection) {
                continue;
            }

            const overlapRatio = interaction.intersectionOverlapRatios.get(intersection.id) ?? 0;
            const highlightRatio = interaction.intersectionHighlightRatios.get(intersection.id) ?? 0;
            if (overlapRatio <= 0 && highlightRatio <= 0) {
                continue;
            }

            context.globalAlpha = interaction.explicitIntersectionIds.has(intersection.id)
                ? 0.08
                : (interaction.explicitSelectionActive
                    ? (0.05 + (overlapRatio * 0.08))
                    : (0.03 + (highlightRatio * 0.06)));
            context.fillStyle = settings.selectedColor;
            fillRoundedRect(context, {
                x: columnLayout.x + 1,
                y: columnLayout.barRect.y,
                width: Math.max(0, columnLayout.width - 2),
                height: columnLayout.barRect.height + layout.padding + columnLayout.matrixRect.height,
            }, 8);
        }

        context.globalAlpha = 0.8;
        context.strokeStyle = settings.gridColor;
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(layout.topBarRect.x, layout.topBarBaselineY + 0.5);
        context.lineTo(layout.topBarRect.x + layout.topBarRect.width, layout.topBarBaselineY + 0.5);
        context.stroke();
        context.globalAlpha = 1;
    }

    private drawSetBars(
        data: DisplayedVisualData,
        layout: UpSetLayout,
        settings: ResolvedSettings,
        selectedRowKeys: Set<string>,
        interaction: InteractionContext,
        maxSetSize: number,
    ): void {
        const context = this.context;
        const fontSize = clamp(settings.fontSize, 10, 20);
        context.font = `500 ${fontSize}px ${FONT_FAMILY}`;

        for (const rowLayout of layout.rowLayouts) {
            const setDatum = data.sets[rowLayout.index];
            if (!setDatum) {
                continue;
            }

            const explicitlySelected = interaction.explicitSetIds.has(setDatum.id);
            const hostSelected = isDatumSelected(setDatum.selectionKeys, selectedRowKeys);
            const overlapRatio = interaction.setOverlapRatios.get(setDatum.setIndex) ?? 0;
            const nativeHighlightRatio = interaction.setHighlightRatios.get(setDatum.setIndex) ?? 0;
            const related = overlapRatio > 0;
            const alpha = resolveDatumAlpha(settings, interaction, explicitlySelected, related, hostSelected);
            const barLength = maxSetSize > 0 ? (setDatum.size / maxSetSize) * rowLayout.barRect.width : 0;
            const barRect: Rect = {
                x: rowLayout.barRect.x + rowLayout.barRect.width - barLength,
                y: rowLayout.y + (rowLayout.height * 0.22),
                width: barLength,
                height: rowLayout.height * 0.56,
            };

            context.globalAlpha = 0.7;
            context.fillStyle = settings.gridColor;
            context.fillRect(rowLayout.barRect.x, rowLayout.centerY, rowLayout.barRect.width, 1);

            context.globalAlpha = alpha;
            context.fillStyle = explicitlySelected ? settings.selectedColor : settings.setBarColor;
            fillRoundedRect(context, barRect, Math.min(6, barRect.height / 2));

            if (interaction.nativeHighlightActive && !interaction.explicitSelectionActive && nativeHighlightRatio > 0 && barRect.width > 3) {
                const highlightWidth = Math.min(barRect.width, Math.max(5, barRect.width * nativeHighlightRatio));
                context.globalAlpha = 0.96;
                context.fillStyle = settings.selectedColor;
                fillRoundedRect(context, {
                    x: barRect.x + barRect.width - highlightWidth,
                    y: barRect.y,
                    width: highlightWidth,
                    height: barRect.height,
                }, Math.min(6, barRect.height / 2));
            }

            if (related && !explicitlySelected && !interaction.nativeHighlightActive && barRect.width > 3) {
                const highlightWidth = Math.min(barRect.width, Math.max(5, barRect.width * overlapRatio));
                context.globalAlpha = 0.92;
                context.fillStyle = settings.selectedColor;
                fillRoundedRect(context, {
                    x: barRect.x + barRect.width - highlightWidth,
                    y: barRect.y,
                    width: highlightWidth,
                    height: barRect.height,
                }, Math.min(6, barRect.height / 2));
            }

            if (explicitlySelected || hostSelected) {
                context.globalAlpha = 1;
                context.strokeStyle = settings.selectedColor;
                context.lineWidth = settings.isHighContrast ? 3 : 2;
                strokeRoundedRect(context, barRect, Math.min(6, barRect.height / 2));
            }

            if (settings.showSetLabels && rowLayout.labelRect.width > 0) {
                context.fillStyle = explicitlySelected ? settings.selectedColor : settings.textColor;
                context.globalAlpha = related ? 1 : alpha;
                this.drawSetLabel(setDatum.name, rowLayout, settings, fontSize);
            }

            if (settings.showBarCounts && rowLayout.countRect.width > 0) {
                context.fillStyle = related ? settings.textColor : settings.connectorColor;
                context.globalAlpha = alpha;
                context.textAlign = "right";
                context.textBaseline = "middle";
                context.font = `500 ${Math.max(10, fontSize - 1)}px ${FONT_FAMILY}`;

                let countText = formatCountValue(setDatum.size, settings, data.countFormatString);
                if (settings.showPercentages && data.totalCount > 0) {
                    countText = `${countText} ${formatPercentValue(setDatum.size / data.totalCount, settings.locale)}`;
                }

                const fitted = fitEndEllipsis(context, this.textMeasureCache, countText, rowLayout.countRect.width);
                context.fillText(fitted, rowLayout.countRect.x + rowLayout.countRect.width, rowLayout.centerY);
            }
        }
    }

    private drawSetLabel(label: string, rowLayout: RowLayout, settings: ResolvedSettings, fontSize: number): void {
        const context = this.context;
        if (settings.labelStrategy === "wrap" && rowLayout.height >= (fontSize * 1.8)) {
            const maxLines = Math.max(1, Math.min(2, Math.floor(rowLayout.height / (fontSize + 2))));
            const lines = wrapText(context, this.textMeasureCache, label, rowLayout.labelRect.width, maxLines);
            const totalHeight = lines.length * (fontSize + 2);
            let lineY = rowLayout.y + Math.max(0, (rowLayout.height - totalHeight) / 2);
            context.textAlign = "left";
            context.textBaseline = "top";

            for (const line of lines) {
                context.fillText(line, rowLayout.labelRect.x, lineY);
                lineY += fontSize + 2;
            }

            return;
        }

        context.textAlign = "left";
        context.textBaseline = "middle";
        const fitted = settings.labelStrategy === "middle"
            ? fitMiddleEllipsis(context, this.textMeasureCache, label, rowLayout.labelRect.width)
            : fitEndEllipsis(context, this.textMeasureCache, label, rowLayout.labelRect.width);
        context.fillText(fitted, rowLayout.labelRect.x, rowLayout.centerY);
    }

    private drawIntersectionBars(
        data: DisplayedVisualData,
        layout: UpSetLayout,
        settings: ResolvedSettings,
        selectedRowKeys: Set<string>,
        interaction: InteractionContext,
        maxIntersectionCount: number,
    ): void {
        const context = this.context;
        const barWidth = Math.max(6, Math.min(layout.columnWidth * 0.7, 30));
        const textFont = `600 ${Math.max(10, settings.fontSize - 1)}px ${FONT_FAMILY}`;
        const visibleLabelTiers = settings.showBarCounts
            ? this.computeIntersectionLabelTiers(data, layout, settings, selectedRowKeys, interaction, textFont)
            : new Map<string, number>();

        for (const columnLayout of layout.columnLayouts) {
            const intersection = data.displayedIntersections[columnLayout.index];
            if (!intersection) {
                continue;
            }

            const explicitlySelected = interaction.explicitIntersectionIds.has(intersection.id);
            const hostSelected = isDatumSelected(intersection.selectionKeys, selectedRowKeys);
            const overlapRatio = interaction.intersectionOverlapRatios.get(intersection.id) ?? 0;
            const nativeHighlightRatio = interaction.intersectionHighlightRatios.get(intersection.id) ?? 0;
            const related = overlapRatio > 0;
            const alpha = resolveDatumAlpha(settings, interaction, explicitlySelected, related, hostSelected);
            const scaledHeight = intersection.count > 0
                ? Math.max(1, (intersection.count / maxIntersectionCount) * columnLayout.barRect.height)
                : 0;
            const x = columnLayout.centerX - (barWidth / 2);
            const y = columnLayout.barRect.y + columnLayout.barRect.height - scaledHeight;
            const barRect: Rect = { x, y, width: barWidth, height: scaledHeight };
            const radius = Math.min(6, barWidth / 2);

            const fullyContained = overlapRatio >= 0.999;
            context.globalAlpha = alpha;
            context.fillStyle = explicitlySelected || (related && fullyContained)
                ? settings.selectedColor
                : settings.intersectionBarColor;
            fillRoundedRect(context, barRect, radius);

            if (interaction.nativeHighlightActive && !interaction.explicitSelectionActive && nativeHighlightRatio > 0 && scaledHeight > 4) {
                const highlightHeight = Math.min(scaledHeight, Math.max(4, scaledHeight * nativeHighlightRatio));
                context.globalAlpha = 0.96;
                context.fillStyle = settings.selectedColor;
                fillRoundedRect(context, {
                    x: barRect.x,
                    y: barRect.y + barRect.height - highlightHeight,
                    width: barRect.width,
                    height: highlightHeight,
                }, radius);
            }

            if (related && !explicitlySelected && !interaction.nativeHighlightActive && !fullyContained && scaledHeight > 4) {
                const accentHeight = Math.min(scaledHeight, Math.max(4, scaledHeight * overlapRatio));
                context.globalAlpha = 0.92;
                context.fillStyle = settings.selectedColor;
                fillRoundedRect(context, {
                    x: barRect.x,
                    y: barRect.y + barRect.height - accentHeight,
                    width: barRect.width,
                    height: accentHeight,
                }, radius);
            }

            if (intersection.isOther) {
                context.globalAlpha = 0.9;
                context.strokeStyle = settings.connectorColor;
                context.lineWidth = 1;
                strokeRoundedRect(context, barRect, radius);
            } else if (explicitlySelected || hostSelected) {
                context.globalAlpha = 1;
                context.strokeStyle = settings.selectedColor;
                context.lineWidth = settings.isHighContrast ? 3 : 2;
                strokeRoundedRect(context, barRect, radius);
            }

            if (settings.showBarCounts && columnLayout.width >= 20) {
                const tier = visibleLabelTiers.get(intersection.id);
                if (tier === undefined) {
                    continue;
                }

                context.globalAlpha = alpha;
                context.fillStyle = explicitlySelected ? settings.selectedColor : settings.connectorColor;
                context.textAlign = "center";
                context.textBaseline = "bottom";
                context.font = textFont;
                const label = formatCountValue(intersection.count, settings, data.countFormatString);
                const fitted = settings.countDisplayFormat === "standard"
                    ? label
                    : fitEndEllipsis(context, this.textMeasureCache, label, columnLayout.width + 8);
                const tierOffset = tier * (Math.max(10, settings.fontSize - 1) + 3);
                context.fillText(fitted, columnLayout.centerX, y - 3 - tierOffset);
            }
        }
    }

    private computeIntersectionLabelTiers(
        data: DisplayedVisualData,
        layout: UpSetLayout,
        settings: ResolvedSettings,
        selectedRowKeys: Set<string>,
        interaction: InteractionContext,
        font: string,
    ): Map<string, number> {
        const context = this.context;
        const assignedTiers = new Map<string, number>();
        const tierRightEdges = [Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
        const minimumGap = 6;
        const maximumDensity = layout.columnLayouts.length > 18 ? 0.9 : 1.15;

        context.save();
        context.font = font;

        for (const columnLayout of layout.columnLayouts) {
            const intersection = data.displayedIntersections[columnLayout.index];
            if (!intersection) {
                continue;
            }

            const explicitlySelected = interaction.explicitIntersectionIds.has(intersection.id);
            const hostSelected = isDatumSelected(intersection.selectionKeys, selectedRowKeys);
            const label = formatCountValue(intersection.count, settings, data.countFormatString);
            const measuredWidth = this.textMeasureCache.measure(context, label);
            const allowedWidth = settings.countDisplayFormat === "standard"
                ? measuredWidth
                : Math.max(columnLayout.width + 8, columnLayout.width * maximumDensity);
            const visualWidth = Math.min(measuredWidth, allowedWidth);
            const left = columnLayout.centerX - (visualWidth / 2);
            const right = columnLayout.centerX + (visualWidth / 2);

            if (explicitlySelected || hostSelected) {
                const tier = tierRightEdges[0] <= left - minimumGap ? 0 : 1;
                tierRightEdges[tier] = Math.max(tierRightEdges[tier], right);
                assignedTiers.set(intersection.id, tier);
                continue;
            }

            if (columnLayout.width < 18 && layout.columnLayouts.length > 10) {
                continue;
            }

            let assignedTier = -1;
            for (let tier = 0; tier < tierRightEdges.length; tier += 1) {
                if (tierRightEdges[tier] <= left - minimumGap) {
                    assignedTier = tier;
                    tierRightEdges[tier] = right;
                    break;
                }
            }

            if (assignedTier >= 0) {
                assignedTiers.set(intersection.id, assignedTier);
            }
        }

        context.restore();
        return assignedTiers;
    }

    private drawConnectorsAndDots(
        data: DisplayedVisualData,
        layout: UpSetLayout,
        settings: ResolvedSettings,
        selectedRowKeys: Set<string>,
        interaction: InteractionContext,
    ): void {
        const context = this.context;
        const dotRadius = clamp(settings.dotRadius, 2, Math.max(2, Math.floor(layout.rowHeight / 2) - 1));

        for (const columnLayout of layout.columnLayouts) {
            const intersection = data.displayedIntersections[columnLayout.index];
            if (!intersection) {
                continue;
            }

            const explicitlySelected = interaction.explicitIntersectionIds.has(intersection.id);
            const hostSelected = isDatumSelected(intersection.selectionKeys, selectedRowKeys);
            const overlapRatio = interaction.intersectionOverlapRatios.get(intersection.id) ?? 0;
            const nativeHighlightRatio = interaction.intersectionHighlightRatios.get(intersection.id) ?? 0;
            const related = overlapRatio > 0;
            const alpha = resolveDatumAlpha(settings, interaction, explicitlySelected, related, hostSelected);
            const nativeHighlighted = interaction.nativeHighlightActive && nativeHighlightRatio > 0;

            if (!intersection.isOther && intersection.activeSetIndexes.length > 1) {
                const firstRow = layout.rowLayouts[intersection.activeSetIndexes[0]];
                const lastRow = layout.rowLayouts[intersection.activeSetIndexes[intersection.activeSetIndexes.length - 1]];

                if (firstRow && lastRow) {
                    context.globalAlpha = explicitlySelected
                        ? 0.96
                        : (nativeHighlighted
                            ? 0.52 + (0.32 * nativeHighlightRatio)
                            : (related ? 0.48 + (0.32 * overlapRatio) : alpha));
                    context.strokeStyle = explicitlySelected || nativeHighlighted || related ? settings.selectedColor : settings.connectorColor;
                    context.lineWidth = explicitlySelected ? settings.connectorThickness + 0.75 : settings.connectorThickness;
                    context.lineCap = "round";
                    context.beginPath();
                    context.moveTo(columnLayout.centerX, firstRow.centerY);
                    context.lineTo(columnLayout.centerX, lastRow.centerY);
                    context.stroke();
                }
            }

            for (const rowLayout of layout.rowLayouts) {
                const active = !intersection.isOther && intersection.activeSetIndexes.includes(rowLayout.index);
                const rowHighlighted = interaction.highlightedSetIndexes.has(rowLayout.index);
                const dotAlpha = interaction.explicitSelectionActive
                    ? (explicitlySelected ? 1 : (rowHighlighted || related ? 0.92 : Math.max(settings.dimmedOpacity, 0.58)))
                    : (interaction.nativeHighlightActive
                        ? (nativeHighlighted ? 1 : 0.78)
                        : (interaction.externalSelectionActive ? (hostSelected ? 1 : Math.max(settings.dimmedOpacity, 0.52)) : 1));

                context.globalAlpha = dotAlpha;
                context.beginPath();
                context.arc(columnLayout.centerX, rowLayout.centerY, dotRadius, 0, Math.PI * 2);
                context.fillStyle = active
                    ? ((explicitlySelected || rowHighlighted || nativeHighlighted) ? settings.selectedColor : settings.activeDotColor)
                    : settings.inactiveDotColor;
                context.fill();

                if (settings.isHighContrast || (!active && settings.inactiveDotColor === settings.backgroundColor)) {
                    context.strokeStyle = settings.highContrastForeground;
                    context.lineWidth = 1;
                    context.stroke();
                } else if (explicitlySelected && active) {
                    context.strokeStyle = settings.selectedColor;
                    context.lineWidth = 2;
                    context.stroke();
                }
            }

            if (intersection.isOther) {
                context.globalAlpha = alpha;
                context.fillStyle = settings.connectorColor;
                context.font = `600 ${Math.max(10, settings.fontSize)}px ${FONT_FAMILY}`;
                context.textAlign = "center";
                context.textBaseline = "middle";
                context.fillText("...", columnLayout.centerX, layout.matrixRect.y + (layout.matrixRect.height / 2));
            }
        }

        context.globalAlpha = 1;
    }
}

function buildInteractionContext(
    data: DisplayedVisualData,
    explicitSelectedDatumIds: Set<string>,
    selectedRowKeys: Set<string>,
    intersectionMode: IntersectionMode,
): InteractionContext {
    const explicitIntersectionIds = new Set<string>();
    const explicitSetIds = new Set<string>();
    const highlightedSetIndexes = new Set<number>();
    const selectionPredicates: SelectionPredicate[] = [];

    for (const intersection of data.displayedIntersections) {
        if (!explicitSelectedDatumIds.has(intersection.id) || intersection.isOther) {
            continue;
        }

        explicitIntersectionIds.add(intersection.id);
        selectionPredicates.push({
            kind: "intersection",
            mask: intersection.mask,
        });
        for (const activeSetIndex of intersection.activeSetIndexes) {
            highlightedSetIndexes.add(activeSetIndex);
        }
    }

    for (const setDatum of data.sets) {
        if (!explicitSelectedDatumIds.has(setDatum.id)) {
            continue;
        }

        explicitSetIds.add(setDatum.id);
        highlightedSetIndexes.add(setDatum.setIndex);
        selectionPredicates.push({
            kind: "set",
            mask: 1 << setDatum.setIndex,
        });
    }

    const intersectionOverlapCounts = new Map<string, number>();
    const setOverlapCounts = new Map<number, number>();
    const setHighlightRatios = new Map<number, number>();
    const intersectionHighlightRatios = new Map<string, number>();

    if (selectionPredicates.length > 0) {
        for (const exactIntersection of data.allIntersections) {
            if (!matchesAnyPredicate(exactIntersection.mask, selectionPredicates, intersectionMode)) {
                continue;
            }

            for (const displayedIntersection of data.displayedIntersections) {
                if (displayedIntersection.isOther || !matchesDisplayedIntersection(exactIntersection.mask, displayedIntersection.mask, intersectionMode)) {
                    continue;
                }

                intersectionOverlapCounts.set(
                    displayedIntersection.id,
                    (intersectionOverlapCounts.get(displayedIntersection.id) ?? 0) + exactIntersection.count,
                );
            }

            for (const setDatum of data.sets) {
                if ((exactIntersection.mask & (1 << setDatum.setIndex)) === 0) {
                    continue;
                }

                setOverlapCounts.set(
                    setDatum.setIndex,
                    (setOverlapCounts.get(setDatum.setIndex) ?? 0) + exactIntersection.count,
                );
            }
        }
    }

    const setOverlapRatios = new Map<number, number>();
    for (const setDatum of data.sets) {
        const overlapCount = setOverlapCounts.get(setDatum.setIndex) ?? 0;
        const overlapRatio = setDatum.size > 0 ? Math.min(1, overlapCount / setDatum.size) : 0;
        if (overlapRatio > 0) {
            setOverlapRatios.set(setDatum.setIndex, overlapRatio);
        }

        const nativeHighlightRatio = setDatum.size > 0 ? Math.min(1, setDatum.highlightSize / setDatum.size) : 0;
        if (nativeHighlightRatio > 0) {
            setHighlightRatios.set(setDatum.setIndex, nativeHighlightRatio);
        }
    }

    const intersectionOverlapRatios = new Map<string, number>();
    for (const intersection of data.displayedIntersections) {
        const overlapCount = intersectionOverlapCounts.get(intersection.id) ?? 0;
        const overlapRatio = satisfiesAnyPredicate(intersection.mask, selectionPredicates, intersectionMode)
            ? 1
            : (intersection.count > 0 ? Math.min(1, overlapCount / intersection.count) : 0);
        intersectionOverlapRatios.set(intersection.id, overlapRatio);

        const nativeHighlightRatio = intersection.count > 0
            ? Math.min(1, intersection.highlightCount / intersection.count)
            : 0;
        if (nativeHighlightRatio > 0) {
            intersectionHighlightRatios.set(intersection.id, nativeHighlightRatio);
        }
    }

    return {
        explicitSelectionActive: explicitSelectedDatumIds.size > 0,
        externalSelectionActive: explicitSelectedDatumIds.size === 0 && selectedRowKeys.size > 0,
        nativeHighlightActive: explicitSelectedDatumIds.size === 0 && data.hasHighlights,
        explicitIntersectionIds,
        explicitSetIds,
        highlightedSetIndexes,
        setOverlapRatios,
        intersectionOverlapRatios,
        setHighlightRatios,
        intersectionHighlightRatios,
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

function satisfiesAnyPredicate(mask: number, predicates: SelectionPredicate[], intersectionMode: IntersectionMode): boolean {
    for (const predicate of predicates) {
        if (displayedIntersectionContainsPredicate(mask, predicate, intersectionMode)) {
            return true;
        }
    }

    return false;
}

function matchesPredicate(exactMask: number, predicate: SelectionPredicate, intersectionMode: IntersectionMode): boolean {
    if (predicate.kind === "set") {
        return (exactMask & predicate.mask) !== 0;
    }

    return intersectionMode === "inclusive"
        ? (exactMask & predicate.mask) === predicate.mask
        : exactMask === predicate.mask;
}

function matchesDisplayedIntersection(exactMask: number, displayedMask: number, intersectionMode: IntersectionMode): boolean {
    return intersectionMode === "inclusive"
        ? (exactMask & displayedMask) === displayedMask
        : exactMask === displayedMask;
}

function displayedIntersectionContainsPredicate(
    displayedMask: number,
    predicate: SelectionPredicate,
    intersectionMode: IntersectionMode,
): boolean {
    if (predicate.kind === "set") {
        return (displayedMask & predicate.mask) !== 0;
    }

    return intersectionMode === "inclusive"
        ? (displayedMask & predicate.mask) === predicate.mask
        : displayedMask === predicate.mask;
}

function resolveDatumAlpha(
    settings: ResolvedSettings,
    interaction: InteractionContext,
    explicitlySelected: boolean,
    related: boolean,
    hostSelected: boolean,
): number {
    if (interaction.explicitSelectionActive) {
        if (explicitlySelected) {
            return 1;
        }

        if (related) {
            return 0.96;
        }

        return Math.max(settings.dimmedOpacity, 0.64);
    }

    if (interaction.externalSelectionActive) {
        return hostSelected ? 1 : Math.max(settings.dimmedOpacity, 0.56);
    }

    if (interaction.nativeHighlightActive) {
        return 1;
    }

    return 1;
}

function fillRoundedRect(context: CanvasRenderingContext2D, rect: Rect, radius: number): void {
    if (rect.width <= 0 || rect.height <= 0) {
        return;
    }

    const safeRadius = Math.min(radius, rect.width / 2, rect.height / 2);
    context.beginPath();
    roundedRectPath(context, rect, safeRadius);
    context.fill();
}

function strokeRoundedRect(context: CanvasRenderingContext2D, rect: Rect, radius: number): void {
    if (rect.width <= 0 || rect.height <= 0) {
        return;
    }

    const safeRadius = Math.min(radius, rect.width / 2, rect.height / 2);
    context.beginPath();
    roundedRectPath(context, rect, safeRadius);
    context.stroke();
}

function roundedRectPath(context: CanvasRenderingContext2D, rect: Rect, radius: number): void {
    context.moveTo(rect.x + radius, rect.y);
    context.lineTo(rect.x + rect.width - radius, rect.y);
    context.quadraticCurveTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + radius);
    context.lineTo(rect.x + rect.width, rect.y + rect.height - radius);
    context.quadraticCurveTo(rect.x + rect.width, rect.y + rect.height, rect.x + rect.width - radius, rect.y + rect.height);
    context.lineTo(rect.x + radius, rect.y + rect.height);
    context.quadraticCurveTo(rect.x, rect.y + rect.height, rect.x, rect.y + rect.height - radius);
    context.lineTo(rect.x, rect.y + radius);
    context.quadraticCurveTo(rect.x, rect.y, rect.x + radius, rect.y);
    context.closePath();
}

function fitEndEllipsis(
    context: CanvasRenderingContext2D,
    cache: TextMeasureCache,
    text: string,
    maxWidth: number,
): string {
    if (cache.measure(context, text) <= maxWidth) {
        return text;
    }

    const ellipsis = "...";
    const ellipsisWidth = cache.measure(context, ellipsis);
    if (ellipsisWidth >= maxWidth) {
        return ellipsis;
    }

    let truncated = text;
    while (truncated.length > 0 && cache.measure(context, `${truncated}${ellipsis}`) > maxWidth) {
        truncated = truncated.slice(0, -1);
    }

    return `${truncated}${ellipsis}`;
}

function fitMiddleEllipsis(
    context: CanvasRenderingContext2D,
    cache: TextMeasureCache,
    text: string,
    maxWidth: number,
): string {
    if (cache.measure(context, text) <= maxWidth) {
        return text;
    }

    const ellipsis = "...";
    if (cache.measure(context, ellipsis) >= maxWidth) {
        return ellipsis;
    }

    let prefixLength = Math.ceil(text.length / 2);
    let suffixLength = Math.floor(text.length / 2);
    while (prefixLength > 0 && suffixLength > 0) {
        const candidate = `${text.slice(0, prefixLength)}${ellipsis}${text.slice(text.length - suffixLength)}`;
        if (cache.measure(context, candidate) <= maxWidth) {
            return candidate;
        }

        if (prefixLength >= suffixLength) {
            prefixLength -= 1;
        } else {
            suffixLength -= 1;
        }
    }

    return ellipsis;
}

function wrapText(
    context: CanvasRenderingContext2D,
    cache: TextMeasureCache,
    text: string,
    maxWidth: number,
    maxLines: number,
): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [text];
    }

    const lines: string[] = [];
    let currentLine = words[0];

    for (let index = 1; index < words.length; index += 1) {
        const candidate = `${currentLine} ${words[index]}`;
        if (cache.measure(context, candidate) <= maxWidth) {
            currentLine = candidate;
            continue;
        }

        lines.push(currentLine);
        currentLine = words[index];
        if (lines.length === maxLines - 1) {
            break;
        }
    }

    const consumedWords = lines.join(" ").split(/\s+/).filter(Boolean).length;
    const remainder = words.slice(consumedWords).join(" ") || currentLine;
    lines.push(fitEndEllipsis(context, cache, remainder, maxWidth));
    return lines.slice(0, maxLines);
}
