import powerbi from "powerbi-visuals-api";

export type PrimitiveValue = string | number | boolean | null | undefined;
export type SortMode = "countDescending" | "lexical" | "degreeThenCount";
export type LabelStrategy = "truncate" | "middle" | "wrap";
export type CountDisplayFormat = "standard" | "compact" | "raw";
export type IntersectionMode = "exact" | "inclusive";
export type DataStatus = "ready" | "empty" | "invalid";
export type HitTargetKind = "intersection" | "set";

export type SelectionId = powerbi.extensibility.ISelectionId & powerbi.visuals.ISelectionId;
export type TooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

export interface SetColumnDescriptor {
    setIndex: number;
    sourceIndex: number;
    displayName: string;
    queryName?: string;
    bit: number;
}

export interface SelectionBackedDatum {
    selectionIds: SelectionId[];
    selectionKeys: string[];
    primarySelectionId: SelectionId | null;
}

export interface IntersectionDatum extends SelectionBackedDatum {
    id: string;
    mask: number;
    count: number;
    degree: number;
    activeSetIndexes: number[];
    label: string;
    customLabel?: string;
    sortMetric: number | null;
    rowCount: number;
    isOther?: boolean;
    hiddenIntersectionCount?: number;
}

export interface SetDatum extends SelectionBackedDatum {
    id: string;
    setIndex: number;
    name: string;
    size: number;
}

export interface ParsedVisualData {
    status: DataStatus;
    statusMessage?: string;
    totalCount: number;
    validRowCount: number;
    skippedRowCount: number;
    countFormatString?: string;
    sortMetricFormatString?: string;
    setColumns: SetColumnDescriptor[];
    sets: SetDatum[];
    allIntersections: IntersectionDatum[];
}

export interface DisplayedVisualData extends ParsedVisualData {
    displayedIntersections: IntersectionDatum[];
    hiddenEligibleIntersectionCount: number;
}

export interface Rect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface RowLayout {
    index: number;
    y: number;
    height: number;
    centerY: number;
    labelRect: Rect;
    countRect: Rect;
    barRect: Rect;
    hitRect: Rect;
}

export interface ColumnLayout {
    index: number;
    x: number;
    width: number;
    centerX: number;
    barRect: Rect;
    matrixRect: Rect;
    hitRect: Rect;
}

export interface UpSetLayout {
    viewportWidth: number;
    viewportHeight: number;
    padding: number;
    leftPanelRect: Rect;
    matrixRect: Rect;
    topBarRect: Rect;
    rowHeight: number;
    columnWidth: number;
    rowLayouts: RowLayout[];
    columnLayouts: ColumnLayout[];
    setBarAreaRect: Rect;
    setLabelAreaRect: Rect;
    setCountAreaRect: Rect;
    topBarBaselineY: number;
}

export interface ResolvedSettings {
    intersectionMode: IntersectionMode;
    maxIntersections: number;
    sortMode: SortMode;
    minimumCount: number;
    showOther: boolean;
    showEmptyIntersection: boolean;
    activeDotColor: string;
    inactiveDotColor: string;
    connectorColor: string;
    intersectionBarColor: string;
    setBarColor: string;
    selectedColor: string;
    backgroundColor: string;
    dimmedOpacity: number;
    showSetLabels: boolean;
    fontSize: number;
    labelStrategy: LabelStrategy;
    showBarCounts: boolean;
    countDisplayFormat: CountDisplayFormat;
    showPercentages: boolean;
    leftPanelWidth: number;
    rowHeight: number;
    columnWidth: number;
    intersectionBarHeight: number;
    dotRadius: number;
    connectorThickness: number;
    innerPadding: number;
    enableSelection: boolean;
    showGuide: boolean;
    respectHighContrast: boolean;
    enableDebugLogging: boolean;
    locale: string;
    textColor: string;
    gridColor: string;
    isHighContrast: boolean;
    highContrastForeground: string;
    highContrastBackground: string;
}

export interface RenderState {
    data: DisplayedVisualData;
    layout: UpSetLayout;
    settings: ResolvedSettings;
    selectedRowKeys: Set<string>;
    explicitSelectedDatumIds: Set<string>;
}
