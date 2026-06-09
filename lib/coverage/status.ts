export const COVERAGE_SIGNALS = ["已下单", "新增商机"] as const;
export type CoverageSignal = (typeof COVERAGE_SIGNALS)[number];

export const COVERAGE_STATUSES = [
  "已覆盖",
  "跟进中",
  "未覆盖",
  "暂停",
  "已下单",
  "新增商机",
  "已下单+新增商机",
] as const;
export type CoverageStatus = (typeof COVERAGE_STATUSES)[number];

const LEGACY_COVERED_STATUS = "已覆盖";
const NEGATIVE_MARKERS = new Set([
  "",
  "0",
  "否",
  "无",
  "未",
  "没有",
  "false",
  "no",
  "n",
  "未覆盖",
  "未下单",
  "未新增",
  "未新增商机",
  "无新增商机",
  "-",
]);
const POSITIVE_MARKERS = new Set(["1", "是", "有", "true", "yes", "y", "√", "✓"]);

function normalizeMarker(value: string) {
  return value.trim().replace(/\s+/g, "").toLowerCase();
}

export function hasPositiveCoverageMarker(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return false;

  const normalized = normalizeMarker(value);
  if (NEGATIVE_MARKERS.has(normalized)) return false;
  if (POSITIVE_MARKERS.has(normalized)) return true;

  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return numeric > 0;

  return normalized.length > 0;
}

export function extractCoverageSignals(value: unknown): CoverageSignal[] {
  if (typeof value !== "string") return [];
  return COVERAGE_SIGNALS.filter((signal) => value.includes(signal));
}

export function mergeCoverageSignals(signals: CoverageSignal[]): CoverageStatus | undefined {
  const uniqueSignals = Array.from(new Set(signals));
  if (uniqueSignals.length === 0) return undefined;
  if (uniqueSignals.length === 1) return uniqueSignals[0];
  return "已下单+新增商机";
}

export function normalizeCoverageStatus(value: unknown): CoverageStatus | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if ((COVERAGE_STATUSES as readonly string[]).includes(trimmed)) return trimmed as CoverageStatus;
  return mergeCoverageSignals(extractCoverageSignals(trimmed));
}

export function isCoveredValue(value: unknown): boolean {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === LEGACY_COVERED_STATUS || extractCoverageSignals(trimmed).length > 0;
  }

  if (Array.isArray(value)) return value.some(isCoveredValue);

  if (typeof value === "object" && value !== null) {
    return Object.entries(value).some(([key, item]) => {
      const keyHasCoverageSignal = key === LEGACY_COVERED_STATUS || extractCoverageSignals(key).length > 0;
      if (keyHasCoverageSignal && hasPositiveCoverageMarker(item)) return true;
      return isCoveredValue(item);
    });
  }

  return false;
}
