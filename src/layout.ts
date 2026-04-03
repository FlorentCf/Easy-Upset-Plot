import { DisplayedVisualData, Rect, ResolvedSettings, UpSetLayout } from "./contracts";

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

export function computeLayout(
    viewport: { width: number; height: number },
    data: DisplayedVisualData,
    settings: ResolvedSettings,
): UpSetLayout {
    const viewportWidth = Math.max(1, viewport.width);
    const viewportHeight = Math.max(1, viewport.height);
    const padding = clamp(Math.round(settings.innerPadding), 4, 32);
    const availableWidth = Math.max(40, viewportWidth - (padding * 2));
    const availableHeight = Math.max(40, viewportHeight - (padding * 2));
    const setCount = Math.max(1, data.setColumns.length);
    const intersectionCount = Math.max(1, data.displayedIntersections.length);

    const preferredTopBarHeight = clamp(settings.intersectionBarHeight, 32, Math.max(48, Math.floor(availableHeight * 0.55)));
    const preferredRowHeight = clamp(settings.rowHeight, 14, 40);
    const verticalScale = Math.min(1, availableHeight / (preferredTopBarHeight + (preferredRowHeight * setCount) + padding));
    const topBarHeight = Math.max(32, Math.floor(preferredTopBarHeight * verticalScale));
    const rowHeight = Math.max(12, Math.floor((availableHeight - topBarHeight - padding) / setCount));

    const requestedLeftPanelWidth = clamp(settings.leftPanelWidth, 120, Math.floor(availableWidth * 0.6));
    const minimumMatrixWidth = intersectionCount * 8;
    const leftPanelWidth = clamp(
        Math.min(requestedLeftPanelWidth, availableWidth - minimumMatrixWidth - padding),
        96,
        Math.max(96, availableWidth - minimumMatrixWidth - padding),
    );
    const matrixAvailableWidth = Math.max(24, availableWidth - leftPanelWidth - padding);
    const columnWidth = Math.max(8, matrixAvailableWidth / intersectionCount);
    const matrixWidth = matrixAvailableWidth;

    const leftPanelRect: Rect = {
        x: padding,
        y: padding + topBarHeight + padding,
        width: leftPanelWidth,
        height: rowHeight * setCount,
    };

    const topBarRect: Rect = {
        x: leftPanelRect.x + leftPanelRect.width + padding,
        y: padding,
        width: matrixWidth,
        height: topBarHeight,
    };

    const matrixRect: Rect = {
        x: topBarRect.x,
        y: leftPanelRect.y,
        width: matrixWidth,
        height: rowHeight * setCount,
    };

    const labelAreaWidth = settings.showSetLabels
        ? clamp(Math.floor(leftPanelWidth * 0.52), 0, Math.max(0, leftPanelWidth - 48))
        : 0;
    const countAreaWidth = settings.showBarCounts
        ? clamp(Math.floor(leftPanelWidth * 0.18), 0, Math.max(0, leftPanelWidth - labelAreaWidth - 24))
        : 0;
    const setBarAreaWidth = Math.max(24, leftPanelWidth - labelAreaWidth - countAreaWidth - (padding * 2));

    const setLabelAreaRect: Rect = {
        x: leftPanelRect.x,
        y: leftPanelRect.y,
        width: labelAreaWidth,
        height: leftPanelRect.height,
    };

    const setCountAreaRect: Rect = {
        x: setLabelAreaRect.x + setLabelAreaRect.width + (labelAreaWidth > 0 ? padding : 0),
        y: leftPanelRect.y,
        width: countAreaWidth,
        height: leftPanelRect.height,
    };

    const setBarAreaRect: Rect = {
        x: setCountAreaRect.x + setCountAreaRect.width + (countAreaWidth > 0 ? padding : 0),
        y: leftPanelRect.y,
        width: setBarAreaWidth,
        height: leftPanelRect.height,
    };

    const rowLayouts = data.setColumns.map((_, index) => {
        const y = matrixRect.y + (index * rowHeight);
        return {
            index,
            y,
            height: rowHeight,
            centerY: y + (rowHeight / 2),
            labelRect: {
                x: setLabelAreaRect.x,
                y,
                width: setLabelAreaRect.width,
                height: rowHeight,
            },
            countRect: {
                x: setCountAreaRect.x,
                y,
                width: setCountAreaRect.width,
                height: rowHeight,
            },
            barRect: {
                x: setBarAreaRect.x,
                y,
                width: setBarAreaRect.width,
                height: rowHeight,
            },
            hitRect: {
                x: leftPanelRect.x,
                y,
                width: leftPanelRect.width,
                height: rowHeight,
            },
        };
    });

    const columnLayouts = data.displayedIntersections.map((_, index) => {
        const x = matrixRect.x + (index * columnWidth);
        return {
            index,
            x,
            width: columnWidth,
            centerX: x + (columnWidth / 2),
            barRect: {
                x,
                y: topBarRect.y,
                width: columnWidth,
                height: topBarRect.height,
            },
            matrixRect: {
                x,
                y: matrixRect.y,
                width: columnWidth,
                height: matrixRect.height,
            },
            hitRect: {
                x,
                y: topBarRect.y,
                width: columnWidth,
                height: topBarRect.height + padding + matrixRect.height,
            },
        };
    });

    return {
        viewportWidth,
        viewportHeight,
        padding,
        leftPanelRect,
        matrixRect,
        topBarRect,
        rowHeight,
        columnWidth,
        rowLayouts,
        columnLayouts,
        setBarAreaRect,
        setLabelAreaRect,
        setCountAreaRect,
        topBarBaselineY: topBarRect.y + topBarRect.height,
    };
}
