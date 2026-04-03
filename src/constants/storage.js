export const ATM_ID_STORAGE_KEY = "yolohealth_atm_id";

/** Trim and uppercase for kiosk / ATM ID display and API. */
export function normalizeAtmId(id) {
  return String(id ?? "").trim().toUpperCase();
}
