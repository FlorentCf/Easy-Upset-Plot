import powerbi from "powerbi-visuals-api";

import VisualUpdateType = powerbi.VisualUpdateType;

function now(): number {
    return globalThis.performance?.now() ?? Date.now();
}

export class PerfTracker {
    private readonly measurements = new Map<string, number>();
    private updateStartedAt = 0;
    private updateType = 0;

    public reset(updateType: number): void {
        this.measurements.clear();
        this.updateStartedAt = now();
        this.updateType = updateType;
    }

    public measure<T>(name: string, work: () => T): T {
        const startedAt = now();
        const result = work();
        this.measurements.set(name, now() - startedAt);
        return result;
    }

    public finish(enabled: boolean): void {
        this.measurements.set("total", now() - this.updateStartedAt);

        if (!enabled) {
            return;
        }

        const summary = Array.from(this.measurements.entries())
            .map(([name, duration]) => `${name}=${duration.toFixed(1)}ms`)
            .join(" ");

            console.debug(`[UpSet Criteria] ${describeUpdateType(this.updateType)} ${summary}`);
    }
}

function describeUpdateType(updateType: number): string {
    const parts: string[] = [];

    if (updateType & VisualUpdateType.Data) {
        parts.push("data");
    }

    if (updateType & VisualUpdateType.Resize) {
        parts.push("resize");
    }

    if (updateType & VisualUpdateType.ResizeEnd) {
        parts.push("resizeEnd");
    }

    if (updateType & VisualUpdateType.Style) {
        parts.push("style");
    }

    if (updateType & VisualUpdateType.ViewMode) {
        parts.push("viewMode");
    }

    if (updateType & VisualUpdateType.FormattingSubSelectionChange) {
        parts.push("formatSubSelection");
    }

    return parts.length > 0 ? parts.join("+") : "unknown";
}
