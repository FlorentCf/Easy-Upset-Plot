import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";

import "./../style/visual.less";

import {
    DisplayedVisualData,
    HitTargetKind,
    ParsedVisualData,
    ResolvedSettings,
    SelectionId,
    TooltipDataItem,
    UpSetLayout,
} from "./contracts";
import { applyDisplaySettings, parseMatrixData, parseTableData } from "./dataConversion";
import { computeLayout } from "./layout";
import { PerfTracker } from "./perf";
import { CanvasRenderer } from "./rendering";
import { resolveVisualSettings, VisualFormattingSettingsModel } from "./settings";
import { buildIntersectionTooltip, buildSelectionOverlapTooltip, buildSetTooltip } from "./tooltip";

import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import VisualUpdateType = powerbi.VisualUpdateType;

type VisualHost = powerbi.extensibility.visual.IVisualHost;
type SelectionManager = powerbi.extensibility.ISelectionManager;
type DataViewHierarchyLevel = powerbi.DataViewHierarchyLevel;
type DataViewMatrixNode = powerbi.DataViewMatrixNode;

const EMPTY_PARSED_DATA: ParsedVisualData = {
    status: "empty",
    statusMessage: "Add fields to begin.",
    totalCount: 0,
    totalHighlightCount: 0,
    hasHighlights: false,
    validRowCount: 0,
    skippedRowCount: 0,
    countFormatString: undefined,
    sortMetricFormatString: undefined,
    setColumns: [],
    sets: [],
    allIntersections: [],
};

export class Visual implements IVisual {
    private readonly host: VisualHost;
    private readonly selectionManager: SelectionManager;
    private readonly formattingSettingsService: FormattingSettingsService;
    private readonly emptySelectionId: SelectionId;
    private readonly perfTracker = new PerfTracker();
    private readonly root: HTMLDivElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly overlay: HTMLDivElement;
    private readonly statusMessage: HTMLDivElement;
    private readonly landingPage: HTMLDivElement;
    private readonly guideToggle: HTMLButtonElement;
    private readonly guidePanel: HTMLDivElement;
    private readonly liveRegion: HTMLDivElement;
    private readonly renderer: CanvasRenderer;
    private readonly allowInteractions: boolean;

    private formattingSettings = new VisualFormattingSettingsModel();
    private parsedData: ParsedVisualData = EMPTY_PARSED_DATA;
    private displayData: DisplayedVisualData = {
        ...EMPTY_PARSED_DATA,
        displayedIntersections: [],
        hiddenEligibleIntersectionCount: 0,
    };
    private layout: UpSetLayout | null = null;
    private selectedKeys = new Set<string>();
    private explicitSelectedDatumIds = new Set<string>();
    private resolvedSettings!: ResolvedSettings;
    private lastUpdateOptions: VisualUpdateOptions | null = null;
    private intersectionButtons: HTMLButtonElement[] = [];
    private setButtons: HTMLButtonElement[] = [];
    private pendingSelectionSignature = "";
    private isGuideExpanded = true;

    constructor(options?: VisualConstructorOptions) {
        if (!options) {
            throw new Error("Visual constructor options are required.");
        }

        this.host = options.host;
        this.selectionManager = this.host.createSelectionManager();
        this.formattingSettingsService = new FormattingSettingsService(this.host.createLocalizationManager());
        this.emptySelectionId = this.host.createSelectionIdBuilder().createSelectionId();
        this.allowInteractions = options.host.hostCapabilities?.allowInteractions ?? true;
        this.resolvedSettings = resolveVisualSettings(this.formattingSettings, this.host.colorPalette, this.host.locale);

        this.root = document.createElement("div");
        this.root.className = "fast-upset";
        this.root.setAttribute("role", "group");
        this.root.setAttribute("aria-label", "Easy UpSet Plot custom visual");
        this.root.tabIndex = 0;

        this.canvas = document.createElement("canvas");
        this.canvas.className = "fast-upset__canvas";

        this.overlay = document.createElement("div");
        this.overlay.className = "fast-upset__overlay";

        this.statusMessage = document.createElement("div");
        this.statusMessage.className = "fast-upset__message";

        this.landingPage = document.createElement("div");
        this.landingPage.className = "fast-upset__landing";
        this.landingPage.hidden = true;

        this.guideToggle = document.createElement("button");
        this.guideToggle.type = "button";
        this.guideToggle.className = "fast-upset__guide-toggle";
        this.guideToggle.textContent = "Guide";
        this.guideToggle.addEventListener("click", this.handleGuideToggle);

        this.guidePanel = document.createElement("div");
        this.guidePanel.className = "fast-upset__guide";
        this.guidePanel.hidden = true;

        this.liveRegion = document.createElement("div");
        this.liveRegion.className = "fast-upset__live-region";
        this.liveRegion.setAttribute("aria-live", "polite");
        this.liveRegion.setAttribute("aria-atomic", "true");

        this.root.append(this.canvas, this.overlay, this.statusMessage, this.landingPage, this.guideToggle, this.guidePanel, this.liveRegion);
        options.element.appendChild(this.root);

        this.renderer = new CanvasRenderer(this.canvas);

        this.selectionManager.registerOnSelectCallback((selectionIds) => {
            const nextSelectionIds = selectionIds as SelectionId[];
            this.syncSelectionState(nextSelectionIds);
            const nextSignature = buildSelectionSignature(nextSelectionIds);
            const cameFromThisVisual = this.pendingSelectionSignature === nextSignature;

            if (nextSelectionIds.length === 0 || !cameFromThisVisual) {
                this.explicitSelectedDatumIds.clear();
            }

            this.pendingSelectionSignature = "";
            this.liveRegion.textContent = nextSelectionIds.length === 0
                ? "Selection cleared."
                : `${nextSelectionIds.length} selection${nextSelectionIds.length === 1 ? "" : "s"} active.`;
            this.renderCurrentState();
        });

        this.canvas.addEventListener("click", this.handleBackgroundClick);
        this.canvas.addEventListener("contextmenu", this.handleBackgroundContextMenu);
        this.canvas.addEventListener("pointerleave", this.handlePointerLeave);
        this.root.addEventListener("keydown", this.handleRootKeyDown);
    }

    public update(options: VisualUpdateOptions): void {
        this.lastUpdateOptions = options;
        this.perfTracker.reset(options.type);
        this.host.eventService.renderingStarted(options);

        try {
            const safeDataView = getSafeDataView(options.dataViews?.[0]);
            this.formattingSettings = this.perfTracker.measure("formatting", () =>
                this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, safeDataView),
            );
            this.resolvedSettings = resolveVisualSettings(this.formattingSettings, this.host.colorPalette, this.host.locale);

            if ((options.type & VisualUpdateType.Data) || this.parsedData.status !== "ready") {
                this.parsedData = this.perfTracker.measure("parse", () => {
                    const table = safeDataView.table;
                    const matrix = safeDataView.matrix;
                    if (matrix) {
                        return parseMatrixData(
                            matrix,
                            (pathNodes, levels) => createMatrixSelectionId(this.host, pathNodes, levels),
                        );
                    }
                    if (!table) {
                        return parseTableData(undefined, () => this.emptySelectionId);
                    }
                    return parseTableData(
                        table,
                        (rowIndex) => this.host.createSelectionIdBuilder().withTable(table, rowIndex).createSelectionId() as SelectionId,
                    );
                });
            }

            this.displayData = applyDisplaySettings(this.parsedData, this.resolvedSettings);
            this.layout = this.perfTracker.measure("layout", () => computeLayout(options.viewport, this.displayData, this.resolvedSettings));
            this.syncSelectionState(this.selectionManager.getSelectionIds() as SelectionId[]);
            this.perfTracker.measure("render", () => {
                this.syncStatusMessage();
                this.syncHitTargets();
                this.renderCurrentState();
            });
            this.perfTracker.finish(this.resolvedSettings.enableDebugLogging);
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unexpected rendering error.";
            this.showStatusMessage(message);
            this.clearHitTargets();
            this.host.eventService.renderingFailed(options, message);
            throw error;
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }

    public destroy(): void {
        this.canvas.removeEventListener("click", this.handleBackgroundClick);
        this.canvas.removeEventListener("contextmenu", this.handleBackgroundContextMenu);
        this.canvas.removeEventListener("pointerleave", this.handlePointerLeave);
        this.root.removeEventListener("keydown", this.handleRootKeyDown);
        this.guideToggle.removeEventListener("click", this.handleGuideToggle);
        this.hideTooltip();
    }

    private readonly handleBackgroundClick = async (event: MouseEvent): Promise<void> => {
        if (!this.isSelectionAllowed() || event.target !== this.canvas) {
            return;
        }

        this.explicitSelectedDatumIds.clear();
        this.renderCurrentState();
        await this.selectionManager.clear();
    };

    private readonly handleBackgroundContextMenu = async (event: MouseEvent): Promise<void> => {
        if (!this.allowInteractions) {
            return;
        }

        event.preventDefault();
        await this.selectionManager.showContextMenu(this.emptySelectionId, { x: event.clientX, y: event.clientY });
    };

    private readonly handlePointerLeave = (): void => {
        this.hideTooltip();
    };

    private readonly handleRootKeyDown = async (event: KeyboardEvent): Promise<void> => {
        if (event.key === "Escape" && this.isSelectionAllowed()) {
            this.explicitSelectedDatumIds.clear();
            this.renderCurrentState();
            await this.selectionManager.clear();
        }
    };

    private readonly handleGuideToggle = (): void => {
        this.isGuideExpanded = !this.isGuideExpanded;
        this.syncGuide();
    };

    private syncSelectionState(selectionIds: SelectionId[]): void {
        this.selectedKeys = new Set(selectionIds.map((selectionId) => selectionId.getKey()));
    }

    private syncStatusMessage(): void {
        if (this.displayData.status === "ready" && this.layout) {
            this.statusMessage.hidden = true;
            this.statusMessage.textContent = "";
            this.syncLandingPage();
            this.syncGuide();
            return;
        }

        this.statusMessage.hidden = true;
        this.statusMessage.textContent = this.displayData.statusMessage ?? "No data available.";
        this.syncLandingPage();
        this.syncGuide();
    }

    private showStatusMessage(message: string): void {
        this.statusMessage.hidden = false;
        this.statusMessage.textContent = message;
    }

    private syncLandingPage(): void {
        const showLanding = this.displayData.status !== "ready";
        this.landingPage.hidden = !showLanding;
        if (!showLanding) {
            return;
        }

        replaceChildren(
            this.landingPage,
            createDiv("fast-upset__landing-card", [
                createDiv("fast-upset__landing-title", "Easy UpSet Plot"),
                createDiv("fast-upset__landing-body", "Add one or more Set fields and a Count measure to start exploring intersections."),
                createDiv("fast-upset__landing-steps", "1. Add 0/1 set columns. 2. Add one Count measure. 3. Pick Exact or Inclusive mode in the format pane."),
            ]),
        );
    }

    private syncGuide(): void {
        const shouldShowGuide = this.resolvedSettings.showGuide && this.displayData.status === "ready";
        this.guideToggle.hidden = !shouldShowGuide;
        this.guidePanel.hidden = !shouldShowGuide || !this.isGuideExpanded;
        if (!shouldShowGuide) {
            return;
        }

        this.guideToggle.setAttribute("aria-expanded", this.isGuideExpanded ? "true" : "false");
        replaceChildren(this.guidePanel, buildGuideContent(this.resolvedSettings));
    }

    private renderCurrentState(): void {
        if (!this.layout) {
            return;
        }

        this.renderer.resize(this.layout.viewportWidth, this.layout.viewportHeight);
        this.renderer.render({
            data: this.displayData,
            layout: this.layout,
            settings: this.resolvedSettings,
            selectedRowKeys: this.selectedKeys,
            explicitSelectedDatumIds: this.explicitSelectedDatumIds,
        });
    }

    private syncHitTargets(): void {
        if (!this.layout || this.displayData.status !== "ready") {
            this.clearHitTargets();
            return;
        }

        this.syncIntersectionButtons();
        this.syncSetButtons();
        this.root.setAttribute(
            "aria-label",
            `Easy UpSet Plot with ${this.displayData.setColumns.length} sets and ${this.displayData.displayedIntersections.length} displayed intersections.`,
        );
    }

    private syncIntersectionButtons(): void {
        ensureButtonCount(this.overlay, this.intersectionButtons, this.displayData.displayedIntersections.length, () => this.createHitButton("intersection"));

        this.displayData.displayedIntersections.forEach((intersection, index) => {
            const button = this.intersectionButtons[index];
            const columnLayout = this.layout?.columnLayouts[index];
            if (!button || !columnLayout) {
                return;
            }

            positionButton(button, columnLayout.hitRect);
            button.dataset.kind = "intersection";
            button.dataset.index = String(index);
            button.hidden = false;
            button.setAttribute(
                "aria-label",
                intersection.isOther
                    ? `Other bucket containing ${intersection.hiddenIntersectionCount ?? 0} hidden intersections. Count ${intersection.count}.`
                    : `Intersection ${intersection.label}. Count ${intersection.count}.`,
            );
            button.setAttribute("aria-disabled", intersection.isOther ? "true" : "false");
        });
    }

    private syncSetButtons(): void {
        ensureButtonCount(this.overlay, this.setButtons, this.displayData.sets.length, () => this.createHitButton("set"));

        this.displayData.sets.forEach((setDatum, index) => {
            const button = this.setButtons[index];
            const rowLayout = this.layout?.rowLayouts[index];
            if (!button || !rowLayout) {
                return;
            }

            positionButton(button, rowLayout.hitRect);
            button.dataset.kind = "set";
            button.dataset.index = String(index);
            button.hidden = false;
            button.setAttribute(
                "aria-label",
                `Set ${setDatum.name}. Size ${setDatum.size}. Select all combinations containing this set.`,
            );
            button.setAttribute("aria-disabled", "false");
        });
    }

    private clearHitTargets(): void {
        for (const button of this.intersectionButtons) {
            button.hidden = true;
        }

        for (const button of this.setButtons) {
            button.hidden = true;
        }
    }

    private createHitButton(kind: HitTargetKind): HTMLButtonElement {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `fast-upset__hit-target fast-upset__hit-target--${kind}`;
        button.addEventListener("click", this.handleHitClick);
        button.addEventListener("contextmenu", this.handleHitContextMenu);
        button.addEventListener("pointerenter", this.handleHitPointerEvent);
        button.addEventListener("pointermove", this.handleHitPointerEvent);
        button.addEventListener("pointerleave", this.handlePointerLeave);
        button.addEventListener("focus", this.handleHitFocus);
        button.addEventListener("blur", this.handlePointerLeave);
        return button;
    }

    private readonly handleHitClick = async (event: MouseEvent): Promise<void> => {
        event.stopPropagation();

        const button = event.currentTarget;
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const target = this.resolveHitTarget(button);
        if (!target || !this.isSelectionAllowed()) {
            return;
        }

        if ("isOther" in target && target.isOther) {
            return;
        }

        button.blur();
        const multiSelect = event.ctrlKey || event.metaKey;
        this.updateExplicitDatumSelection(target.id, multiSelect);
        this.renderCurrentState();
        await this.applySelection(target.selectionIds, multiSelect);
    };

    private readonly handleHitContextMenu = async (event: MouseEvent): Promise<void> => {
        event.preventDefault();
        event.stopPropagation();

        const button = event.currentTarget;
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const target = this.resolveHitTarget(button);
        if (!this.allowInteractions) {
            return;
        }

        const selectionId = target?.primarySelectionId ?? this.emptySelectionId;
        await this.selectionManager.showContextMenu(selectionId, { x: event.clientX, y: event.clientY });
    };

    private readonly handleHitPointerEvent = (event: PointerEvent): void => {
        const button = event.currentTarget;
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const target = this.resolveHitTarget(button);
        if (!target) {
            return;
        }

        this.showTooltip(
            this.resolveTooltipItems(button, target),
            target.selectionIds,
            event.clientX,
            event.clientY,
        );
    };

    private readonly handleHitFocus = (event: FocusEvent): void => {
        const button = event.currentTarget;
        if (!(button instanceof HTMLButtonElement)) {
            return;
        }

        const target = this.resolveHitTarget(button);
        if (!target) {
            return;
        }

        const rect = button.getBoundingClientRect();
        this.showTooltip(
            this.resolveTooltipItems(button, target),
            target.selectionIds,
            rect.left + (rect.width / 2),
            rect.top + (rect.height / 2),
        );
    };

    private resolveHitTarget(button: HTMLButtonElement) {
        const index = Number(button.dataset.index);
        const kind = button.dataset.kind as HitTargetKind | undefined;
        if (!Number.isInteger(index) || !kind) {
            return null;
        }

        return kind === "intersection"
            ? (this.displayData.displayedIntersections[index] ?? null)
            : (this.displayData.sets[index] ?? null);
    }

    private resolveTooltipItems(button: HTMLButtonElement, target: DisplayedVisualData["displayedIntersections"][number] | DisplayedVisualData["sets"][number]): TooltipDataItem[] {
        const baseItems = button.dataset.kind === "intersection"
            ? buildIntersectionTooltip(target as DisplayedVisualData["displayedIntersections"][number], this.displayData, this.resolvedSettings)
            : buildSetTooltip(target as DisplayedVisualData["sets"][number], this.displayData, this.resolvedSettings);
        const overlapItems = buildSelectionOverlapTooltip(
            target as DisplayedVisualData["displayedIntersections"][number] | DisplayedVisualData["sets"][number],
            this.displayData,
            this.resolvedSettings,
            this.explicitSelectedDatumIds,
        );
        return baseItems.concat(overlapItems);
    }

    private async applySelection(selectionIds: SelectionId[], multiSelect: boolean): Promise<void> {
        if (!selectionIds.length) {
            return;
        }

        const currentSelectionIds = this.selectionManager.getSelectionIds() as SelectionId[];

        if (!multiSelect) {
            if (selectionSetEquals(currentSelectionIds, selectionIds)) {
                this.pendingSelectionSignature = "";
                await this.selectionManager.clear();
                return;
            }

            this.pendingSelectionSignature = buildSelectionSignature(selectionIds);
            await this.selectionManager.select(selectionIds, false);
            return;
        }

        const nextSelectionIds = toggleSelectionIds(currentSelectionIds, selectionIds);
        if (nextSelectionIds.length === 0) {
            this.pendingSelectionSignature = "";
            await this.selectionManager.clear();
            return;
        }

        this.pendingSelectionSignature = buildSelectionSignature(nextSelectionIds);
        await this.selectionManager.select(nextSelectionIds, false);
    }

    private updateExplicitDatumSelection(datumId: string, multiSelect: boolean): void {
        if (!multiSelect) {
            const alreadyOnlySelection = this.explicitSelectedDatumIds.size === 1 && this.explicitSelectedDatumIds.has(datumId);
            this.explicitSelectedDatumIds = alreadyOnlySelection ? new Set<string>() : new Set<string>([datumId]);
            return;
        }

        const nextSelection = new Set(this.explicitSelectedDatumIds);
        if (nextSelection.has(datumId)) {
            nextSelection.delete(datumId);
        } else {
            nextSelection.add(datumId);
        }

        this.explicitSelectedDatumIds = nextSelection;
    }

    private showTooltip(dataItems: TooltipDataItem[], selectionIds: SelectionId[], clientX: number, clientY: number): void {
        if (!this.host.tooltipService.enabled()) {
            return;
        }

        this.host.tooltipService.show({
            coordinates: [clientX, clientY],
            isTouchEvent: false,
            dataItems,
            identities: selectionIds.slice(0, 32),
        });
    }

    private hideTooltip(): void {
        this.host.tooltipService.hide({
            isTouchEvent: false,
            immediately: true,
        });
    }

    private isSelectionAllowed(): boolean {
        return this.allowInteractions && this.resolvedSettings.enableSelection;
    }
}

function buildGuideContent(settings: ResolvedSettings): HTMLDivElement {
    const modeTitle = settings.intersectionMode === "inclusive"
        ? "Inclusive mode"
        : "Exact mode";
    const modeDescription = settings.intersectionMode === "inclusive"
        ? "Active dots are required. Grey dots are ignored."
        : "Active dots must be true. Grey dots must be false.";
    const emptyMeaning = settings.intersectionMode === "inclusive"
        ? "No dots = total population."
        : "No dots = none of the sets are true.";

    return createDiv("fast-upset__guide-card", [
        createDiv("fast-upset__guide-title", modeTitle),
        createDiv("fast-upset__guide-line", modeDescription),
        createDiv("fast-upset__guide-line", emptyMeaning),
        createDiv("fast-upset__guide-line", "Click a bar or row to cross-filter. Ctrl/Cmd-click multi-selects."),
    ]);
}

function createDiv(className: string, children: string | HTMLElement[]): HTMLDivElement {
    const element = document.createElement("div");
    element.className = className;
    if (typeof children === "string") {
        element.textContent = children;
    } else {
        children.forEach((child) => element.appendChild(child));
    }

    return element;
}

function replaceChildren(element: HTMLElement, child: HTMLElement): void {
    while (element.firstChild) {
        element.removeChild(element.firstChild);
    }

    element.appendChild(child);
}

function ensureButtonCount(
    overlay: HTMLDivElement,
    buttons: HTMLButtonElement[],
    targetCount: number,
    createButton: () => HTMLButtonElement,
): void {
    while (buttons.length < targetCount) {
        const button = createButton();
        overlay.appendChild(button);
        buttons.push(button);
    }

    buttons.forEach((button, index) => {
        button.hidden = index >= targetCount;
    });
}

function positionButton(button: HTMLButtonElement, rect: { x: number; y: number; width: number; height: number }): void {
    button.style.left = `${rect.x}px`;
    button.style.top = `${rect.y}px`;
    button.style.width = `${rect.width}px`;
    button.style.height = `${rect.height}px`;
}

function toggleSelectionIds(currentSelectionIds: SelectionId[], toggledSelectionIds: SelectionId[]): SelectionId[] {
    const currentByKey = new Map<string, SelectionId>();
    currentSelectionIds.forEach((selectionId) => currentByKey.set(selectionId.getKey(), selectionId));
    const toggledKeys = new Set(toggledSelectionIds.map((selectionId) => selectionId.getKey()));
    const allSelected = toggledSelectionIds.every((selectionId) => currentByKey.has(selectionId.getKey()));

    if (allSelected) {
        return currentSelectionIds.filter((selectionId) => !toggledKeys.has(selectionId.getKey()));
    }

    const merged = currentSelectionIds.slice();
    for (const selectionId of toggledSelectionIds) {
        if (!currentByKey.has(selectionId.getKey())) {
            merged.push(selectionId);
            currentByKey.set(selectionId.getKey(), selectionId);
        }
    }

    return merged;
}

function selectionSetEquals(left: SelectionId[], right: SelectionId[]): boolean {
    if (left.length !== right.length) {
        return false;
    }

    const rightKeys = new Set(right.map((selectionId) => selectionId.getKey()));
    for (const selectionId of left) {
        if (!rightKeys.has(selectionId.getKey())) {
            return false;
        }
    }

    return true;
}

function buildSelectionSignature(selectionIds: SelectionId[]): string {
    return selectionIds
        .map((selectionId) => selectionId.getKey())
        .sort((left, right) => left.localeCompare(right))
        .join("|");
}

function getSafeDataView(dataView: powerbi.DataView | undefined): powerbi.DataView {
    if (dataView) {
        return dataView;
    }

    return {
        metadata: {
            columns: [],
            objects: {},
        },
        table: {
            columns: [],
            rows: [],
        },
    } as powerbi.DataView;
}

function createMatrixSelectionId(
    host: VisualHost,
    pathNodes: DataViewMatrixNode[],
    levels: DataViewHierarchyLevel[],
): SelectionId {
    let builder = host.createSelectionIdBuilder();
    for (const node of pathNodes) {
        builder = builder.withMatrixNode(node, levels);
    }

    return builder.createSelectionId() as SelectionId;
}
