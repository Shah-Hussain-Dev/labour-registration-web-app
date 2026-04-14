import { HEALTH_ATM_API_BASE_URL } from "../constants/healthAtmApiBase.js";

/**
 * POST barcode login for report upload flow.
 * @param {string} barcode
 * @returns {Promise<Record<string, unknown>>}
 */
export async function loginWithBarcode(barcode) {
  const b = String(barcode ?? "").trim();
  if (!b) {
    throw new Error("Barcode is required.");
  }

  const res = await fetch(`${HEALTH_ATM_API_BASE_URL}/v1/login-barcode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ barcode: b }),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  const serverMsg =
    json && (json.message != null || json.error != null)
      ? String(json.message ?? json.error ?? "")
      : "";

  if (!res.ok) {
    throw new Error(serverMsg || text || `Login failed (${res.status}).`);
  }

  if (json && json.success === false) {
    throw new Error(serverMsg || "Login failed.");
  }
  if (json && json.status === false) {
    throw new Error(serverMsg || "Login failed.");
  }

  const token = json?.data && typeof json.data === "object" ? json.data.token : null;
  const loginOk = json?.status === true || json?.success === true;
  if (loginOk && typeof token !== "string") {
    throw new Error("Login response did not include a token.");
  }

  return json ?? { ok: true };
}
