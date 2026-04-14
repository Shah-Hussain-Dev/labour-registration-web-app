export const ATM_ID_STORAGE_KEY = "yolohealth_atm_id";

/** Barcode login session for Upload report (`authToken`, `profile`, `barcode`). Cleared on sign out only. */
export const REPORT_UPLOAD_SESSION_KEY = "yolohealth_report_upload_session";

/** Trim and uppercase for kiosk / ATM ID display and API. */
export function normalizeAtmId(id) {
  return String(id ?? "").trim().toUpperCase();
}

/**
 * @returns {{ barcode: string, authToken: string, profile: object | null } | null}
 */
export function readReportUploadSession() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(REPORT_UPLOAD_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const authToken = typeof parsed.authToken === "string" ? parsed.authToken.trim() : "";
    const barcode = typeof parsed.barcode === "string" ? parsed.barcode.trim() : "";
    if (!authToken) return null;
    return {
      barcode,
      authToken,
      profile: parsed.profile && typeof parsed.profile === "object" ? parsed.profile : null,
    };
  } catch {
    return null;
  }
}

/** @param {{ barcode: string, authToken: string, profile: object | null }} session */
export function writeReportUploadSession(session) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REPORT_UPLOAD_SESSION_KEY, JSON.stringify(session));
  } catch {
    /* quota / private mode */
  }
}

export function clearReportUploadSession() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(REPORT_UPLOAD_SESSION_KEY);
  } catch {
    /* ignore */
  }
}
