const HEALTHATM_API_PREFIX = "/api/healthatm/v1";

/**
 * GET additional camp tests for a patient barcode (proxied in dev via vite.config.js).
 * @param {string} barcode
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchAdditionalTests(barcode) {
  const b = String(barcode ?? "").trim();
  const q = new URLSearchParams({ barcode: b });
  const res = await fetch(`${HEALTHATM_API_PREFIX}/camp/additional-tests?${q.toString()}`);

  let json;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) {
      throw new Error(`Could not load tests (${res.status}).`);
    }
    throw new Error("Could not load tests.");
  }

  const serverMsg = json?.message != null ? String(json.message) : "";

  if (!res.ok) {
    throw new Error(serverMsg || `Could not load tests (${res.status}).`);
  }
  if (!json?.success) {
    throw new Error(serverMsg || "Could not load tests.");
  }

  const list = json?.data?.additional_tests;
  return Array.isArray(list) ? list : [];
}

/**
 * POST mark additional tests done.
 * @param {number[]} ids
 */
export async function markAdditionalTestsDone(ids) {
  const list = [...new Set((ids || []).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0))];
  if (!list.length) {
    throw new Error("No tests to mark.");
  }
  const res = await fetch(`${HEALTHATM_API_PREFIX}/camp/additional-tests/mark-done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: list }),
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error(`Could not mark tests (${res.status}).`);
  }
  if (!res.ok || !json?.success) {
    throw new Error(String(json?.message || `Could not mark tests (${res.status}).`));
  }
  return json;
}
