import powerbi from "powerbi-visuals-api";
import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";

import { CountDisplayFormat, IntersectionMode, LabelStrategy, ResolvedSettings, SortMode } from "./contracts";

import FormattingSettingsCard = formattingSettings.SimpleCard;
import FormattingSettingsModel = formattingSettings.Model;
import FormattingSettingsSlice = formattingSettings.Slice;

const SORT_MODE_ITEMS: powerbi.IEnumMember[] = [
    { value: "countDescending", displayName: "Count descending" },
    { value: "lexical", displayName: "Lexical" },
    { value: "degreeThenCount", displayName: "Degree then count" },
];

const LABEL_STRATEGY_ITEMS: powerbi.IEnumMember[] = [
    { value: "truncate", displayName: "End truncate" },
    { value: "middle", displayName: "Middle truncate" },
    { value: "wrap", displayName: "Wrap" },
];

const COUNT_DISPLAY_ITEMS: powerbi.IEnumMember[] = [
    { value: "standard", displayName: "Standard" },
    { value: "compact", displayName: "Compact" },
    { value: "raw", displayName: "Raw" },
];

const INTERSECTION_MODE_ITEMS: powerbi.IEnumMember[] = [
    { value: "exact", displayName: "Exact (true / false)" },
    { value: "inclusive", displayName: "Inclusive (require / ignore)" },
];

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

class DataDisplayCardSettings extends FormattingSettingsCard {
    intersectionMode = new formattingSettings.ItemDropdown({
        name: "intersectionMode",
        displayName: "Intersection meaning",
        items: INTERSECTION_MODE_ITEMS,
        value: INTERSECTION_MODE_ITEMS[0],
    });

    maxIntersections = new formattingSettings.NumUpDown({
        name: "maxIntersections",
        displayName: "Max intersections to display",
        value: 100,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 200 },
        },
    });

    sortMode = new formattingSettings.ItemDropdown({
        name: "sortMode",
        displayName: "Sort intersections by",
        items: SORT_MODE_ITEMS,
        value: SORT_MODE_ITEMS[0],
    });

    minimumCount = new formattingSettings.NumUpDown({
        name: "minimumCount",
        displayName: "Minimum count threshold",
        value: 1,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 1000000000 },
        },
    });

    showOther = new formattingSettings.ToggleSwitch({
        name: "showOther",
        displayName: "Show Other bucket",
        value: true,
    });

    showEmptyIntersection = new formattingSettings.ToggleSwitch({
        name: "showEmptyIntersection",
        displayName: "Show empty column",
        value: true,
    });

    override name = "dataDisplay";
    override displayName = "Data / Display";
    override slices: Array<FormattingSettingsSlice> = [
        this.intersectionMode,
        this.maxIntersections,
        this.sortMode,
        this.minimumCount,
        this.showOther,
        this.showEmptyIntersection,
    ];
}

class ColorsCardSettings extends FormattingSettingsCard {
    activeDotColor = new formattingSettings.ColorPicker({
        name: "activeDotColor",
        displayName: "Active dot color",
        value: { value: "#177c72" },
    });

    inactiveDotColor = new formattingSettings.ColorPicker({
        name: "inactiveDotColor",
        displayName: "Inactive dot color",
        value: { value: "#dbe4ee" },
    });

    connectorColor = new formattingSettings.ColorPicker({
        name: "connectorColor",
        displayName: "Connector color",
        value: { value: "#5c708a" },
    });

    intersectionBarColor = new formattingSettings.ColorPicker({
        name: "intersectionBarColor",
        displayName: "Intersection bar color",
        value: { value: "#2f5f98" },
    });

    setBarColor = new formattingSettings.ColorPicker({
        name: "setBarColor",
        displayName: "Set bar color",
        value: { value: "#78a2c8" },
    });

    selectedColor = new formattingSettings.ColorPicker({
        name: "selectedColor",
        displayName: "Selected state color",
        value: { value: "#ff8c42" },
    });

    backgroundColor = new formattingSettings.ColorPicker({
        name: "backgroundColor",
        displayName: "Background color",
        value: { value: "#fcfdff" },
    });

    dimmedOpacity = new formattingSettings.NumUpDown({
        name: "dimmedOpacity",
        displayName: "Dimmed opacity",
        value: 0.58,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 0.05 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 1 },
        },
    });

    override name = "colors";
    override displayName = "Colors";
    override slices: Array<FormattingSettingsSlice> = [
        this.activeDotColor,
        this.inactiveDotColor,
        this.connectorColor,
        this.intersectionBarColor,
        this.setBarColor,
        this.selectedColor,
        this.backgroundColor,
        this.dimmedOpacity,
    ];
}

class LabelsCardSettings extends FormattingSettingsCard {
    showSetLabels = new formattingSettings.ToggleSwitch({
        name: "showSetLabels",
        displayName: "Show set labels",
        value: true,
    });

    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize",
        displayName: "Font size",
        value: 13,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 28 },
        },
    });

    labelStrategy = new formattingSettings.ItemDropdown({
        name: "labelStrategy",
        displayName: "Truncate / wrap strategy",
        items: LABEL_STRATEGY_ITEMS,
        value: LABEL_STRATEGY_ITEMS[0],
    });

    showBarCounts = new formattingSettings.ToggleSwitch({
        name: "showBarCounts",
        displayName: "Show counts on bars",
        value: true,
    });

    countDisplayFormat = new formattingSettings.ItemDropdown({
        name: "countDisplayFormat",
        displayName: "Count display format",
        items: COUNT_DISPLAY_ITEMS,
        value: COUNT_DISPLAY_ITEMS[0],
    });

    showPercentages = new formattingSettings.ToggleSwitch({
        name: "showPercentages",
        displayName: "Show percentages",
        value: false,
    });

    override name = "labels";
    override displayName = "Labels";
    override slices: Array<FormattingSettingsSlice> = [
        this.showSetLabels,
        this.fontSize,
        this.labelStrategy,
        this.showBarCounts,
        this.countDisplayFormat,
        this.showPercentages,
    ];
}

class LayoutCardSettings extends FormattingSettingsCard {
    leftPanelWidth = new formattingSettings.NumUpDown({
        name: "leftPanelWidth",
        displayName: "Left panel width",
        value: 236,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 100 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 420 },
        },
    });

    rowHeight = new formattingSettings.NumUpDown({
        name: "rowHeight",
        displayName: "Matrix row height",
        value: 30,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 14 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 44 },
        },
    });

    columnWidth = new formattingSettings.NumUpDown({
        name: "columnWidth",
        displayName: "Matrix column width",
        value: 28,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 8 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 48 },
        },
    });

    intersectionBarHeight = new formattingSettings.NumUpDown({
        name: "intersectionBarHeight",
        displayName: "Top bar chart height",
        value: 132,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 32 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 260 },
        },
    });

    dotRadius = new formattingSettings.NumUpDown({
        name: "dotRadius",
        displayName: "Dot radius",
        value: 5,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 2 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 12 },
        },
    });

    connectorThickness = new formattingSettings.NumUpDown({
        name: "connectorThickness",
        displayName: "Connector thickness",
        value: 2,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 1 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 8 },
        },
    });

    innerPadding = new formattingSettings.NumUpDown({
        name: "innerPadding",
        displayName: "Inner padding",
        value: 14,
        options: {
            minValue: { type: powerbi.visuals.ValidatorType.Min, value: 4 },
            maxValue: { type: powerbi.visuals.ValidatorType.Max, value: 32 },
        },
    });

    override name = "layout";
    override displayName = "Layout";
    override slices: Array<FormattingSettingsSlice> = [
        this.leftPanelWidth,
        this.rowHeight,
        this.columnWidth,
        this.intersectionBarHeight,
        this.dotRadius,
        this.connectorThickness,
        this.innerPadding,
    ];
}

class BehaviorCardSettings extends FormattingSettingsCard {
    enableSelection = new formattingSettings.ToggleSwitch({
        name: "enableSelection",
        displayName: "Enable selection",
        value: true,
    });

    showGuide = new formattingSettings.ToggleSwitch({
        name: "showGuide",
        displayName: "Show guide",
        value: true,
    });

    respectHighContrast = new formattingSettings.ToggleSwitch({
        name: "respectHighContrast",
        displayName: "Respect high contrast",
        value: true,
    });

    enableDebugLogging = new formattingSettings.ToggleSwitch({
        name: "enableDebugLogging",
        displayName: "Enable debug logging",
        value: false,
    });

    override name = "behavior";
    override displayName = "Behavior";
    override slices: Array<FormattingSettingsSlice> = [
        this.enableSelection,
        this.showGuide,
        this.respectHighContrast,
        this.enableDebugLogging,
    ];
}

export class VisualFormattingSettingsModel extends FormattingSettingsModel {
    dataDisplayCard = new DataDisplayCardSettings();
    colorsCard = new ColorsCardSettings();
    labelsCard = new LabelsCardSettings();
    layoutCard = new LayoutCardSettings();
    behaviorCard = new BehaviorCardSettings();

    override cards = [
        this.dataDisplayCard,
        this.colorsCard,
        this.labelsCard,
        this.layoutCard,
        this.behaviorCard,
    ];
}

export function resolveVisualSettings(
    model: VisualFormattingSettingsModel,
    colorPalette: powerbi.extensibility.ISandboxExtendedColorPalette,
    locale: string,
): ResolvedSettings {
    const respectHighContrast = model.behaviorCard.respectHighContrast.value;
    const isHighContrast = respectHighContrast && colorPalette.isHighContrast;
    const foreground = colorPalette.foreground.value;
    const background = colorPalette.background.value;
    const foregroundSelected = colorPalette.foregroundSelected?.value ?? colorPalette.selection?.value ?? foreground;

    return {
        intersectionMode: readEnumValue<IntersectionMode>(model.dataDisplayCard.intersectionMode.value, "exact"),
        maxIntersections: clamp(Math.round(model.dataDisplayCard.maxIntersections.value), 1, 200),
        sortMode: readEnumValue<SortMode>(model.dataDisplayCard.sortMode.value, "countDescending"),
        minimumCount: Math.max(0, Math.round(model.dataDisplayCard.minimumCount.value)),
        showOther: model.dataDisplayCard.showOther.value,
        showEmptyIntersection: model.dataDisplayCard.showEmptyIntersection.value,
        activeDotColor: isHighContrast ? foreground : readColor(model.colorsCard.activeDotColor.value.value, "#177c72"),
        inactiveDotColor: isHighContrast ? background : readColor(model.colorsCard.inactiveDotColor.value.value, "#dbe4ee"),
        connectorColor: isHighContrast ? foreground : readColor(model.colorsCard.connectorColor.value.value, "#5c708a"),
        intersectionBarColor: isHighContrast ? foreground : readColor(model.colorsCard.intersectionBarColor.value.value, "#2f5f98"),
        setBarColor: isHighContrast ? foreground : readColor(model.colorsCard.setBarColor.value.value, "#78a2c8"),
        selectedColor: isHighContrast ? foregroundSelected : readColor(model.colorsCard.selectedColor.value.value, "#ff8c42"),
        backgroundColor: isHighContrast ? background : readColor(model.colorsCard.backgroundColor.value.value, "#fcfdff"),
        dimmedOpacity: clamp(model.colorsCard.dimmedOpacity.value, 0.05, 1),
        showSetLabels: model.labelsCard.showSetLabels.value,
        fontSize: clamp(Math.round(model.labelsCard.fontSize.value), 8, 28),
        labelStrategy: readEnumValue<LabelStrategy>(model.labelsCard.labelStrategy.value, "truncate"),
        showBarCounts: model.labelsCard.showBarCounts.value,
        countDisplayFormat: readEnumValue<CountDisplayFormat>(model.labelsCard.countDisplayFormat.value, "standard"),
        showPercentages: model.labelsCard.showPercentages.value,
        leftPanelWidth: clamp(Math.round(model.layoutCard.leftPanelWidth.value), 100, 420),
        rowHeight: clamp(Math.round(model.layoutCard.rowHeight.value), 14, 44),
        columnWidth: clamp(Math.round(model.layoutCard.columnWidth.value), 8, 48),
        intersectionBarHeight: clamp(Math.round(model.layoutCard.intersectionBarHeight.value), 32, 260),
        dotRadius: clamp(Math.round(model.layoutCard.dotRadius.value), 2, 12),
        connectorThickness: clamp(model.layoutCard.connectorThickness.value, 1, 8),
        innerPadding: clamp(Math.round(model.layoutCard.innerPadding.value), 4, 32),
        enableSelection: model.behaviorCard.enableSelection.value,
        showGuide: model.behaviorCard.showGuide.value,
        respectHighContrast,
        enableDebugLogging: model.behaviorCard.enableDebugLogging.value,
        locale,
        textColor: isHighContrast ? foreground : colorPalette.foreground.value,
        gridColor: isHighContrast ? foreground : "#e4eaf1",
        isHighContrast,
        highContrastForeground: foreground,
        highContrastBackground: background,
    };
}

function readColor(value: string | undefined, fallback: string): string {
    return value && value.length > 0 ? value : fallback;
}

function readEnumValue<T extends string>(value: { value?: powerbi.EnumMemberValue } | undefined, fallback: T): T {
    return (typeof value?.value === "string" ? value.value : fallback) as T;
}
