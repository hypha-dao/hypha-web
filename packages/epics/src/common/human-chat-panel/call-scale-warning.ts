/** CSH-SCALE-2 — warn when mesh call exceeds comfortable tier M (default 12 devices). */
export const CALL_SCALE_WARNING_DEVICE_THRESHOLD = 12;

export function shouldShowCallScaleWarning(deviceCount: number): boolean {
  return (
    Number.isFinite(deviceCount) &&
    deviceCount > CALL_SCALE_WARNING_DEVICE_THRESHOLD
  );
}
