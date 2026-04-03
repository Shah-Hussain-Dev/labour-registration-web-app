/**
 * UK BOCW camp APIs — uses native fetch only.
 * Dev: Vite proxies /yolo-hms-api → https://hms.yolohealth.in/api (see vite.config.js).
 */





const HMS_PUBLIC_BASE = import.meta.env.VITE_API_URL || "https://system.healthatm.com/api";

function apiRoot() {
  return HMS_PUBLIC_BASE;
}

async function postJson(path, body) {
  const url = `${apiRoot()}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) {
    const msg =
      (data && (data.message || data.error || data.detail)) ||
      text ||
      `Request failed (${res.status})`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data;
}

function mapGenderForApi(formGender) {
  const g = String(formGender || "").trim().toLowerCase();
  if (g === "prefer_not") return "other";
  return g;
}

/** 10-digit Indian mobile for +91 / 91; otherwise digits only (8–15). */
export function normalizeMobileForApi(countryCode, mobile) {
  const raw = String(mobile || "").replace(/\D/g, "");
  const cc = String(countryCode || "")
    .trim()
    .replace(/^\+/, "");
  if (cc === "91" || cc === "") {
    if (raw.length === 11 && raw.startsWith("0")) return raw.slice(1);
    return raw.length > 10 ? raw.slice(-10) : raw;
  }
  return raw;
}

function normalizeFromLabourApiRow(raw, fallbackLabRegNo) {
  const labourId = String(
    raw.LabRegNo ?? raw.lab_reg_no ?? raw.labour_id ?? raw.LabourId ?? fallbackLabRegNo ?? "",
  ).trim();

  let dob = raw.Dob ?? raw.dob ?? raw.date_of_birth ?? "";
  if (typeof dob === "string" && dob.includes("T")) dob = dob.slice(0, 10);

  const genderRaw = raw.Gender ?? raw.gender ?? "";
  const gl = String(genderRaw).trim().toLowerCase();
  let gender = "";
  if (gl === "male" || gl === "m") gender = "male";
  else if (gl === "female" || gl === "f") gender = "female";
  else if (gl === "other") gender = "other";
  else if (gl) gender = gl.length <= 20 ? gl : "";

  const mobileDigits = String(raw.MobileNo ?? raw.mobile ?? raw.phone ?? "").replace(/\D/g, "");
  const mobile = mobileDigits.length >= 10 ? mobileDigits.slice(-10) : mobileDigits;

  const aadhaar = String(raw.AadharNo ?? raw.aadhaar ?? raw.adhaar_number ?? "").replace(/\D/g, "");

  const addressPrimary = String(raw.Address ?? raw.address ?? "").trim();
  const division = String(raw.DivisionName ?? raw.division_name ?? "").trim();
  const district = String(raw.DistrictName ?? raw.district_name ?? "").trim();
  const tempAddr = String(raw.TempAddress ?? raw.temp_address ?? "").trim();
  const addressFallback = [division, district, tempAddr].filter(Boolean).join(", ");
  const address = addressPrimary || addressFallback;

  return {
    labourId: labourId || String(fallbackLabRegNo || "").trim(),
    name: String(raw.LabourName ?? raw.name ?? "").trim(),
    countryCode: "+91",
    mobile,
    aadhaar: aadhaar.slice(0, 12),
    email: String(raw.email ?? raw.Email ?? "").trim(),
    dob,
    gender,
    address,
    ayushmanCard: Boolean(raw.ayushmanCard ?? raw.ayushman_card),
    ayushmanCardNumber: String(
      raw.ayushmanCardNumber ?? raw.ayushman_card_number ?? raw.ayushmanCardNo ?? "",
    ).trim(),
    mappedBarcode: "",
  };
}

export function buildRegisterPatientBody(payload) {
  const kiosk_id = String(payload?.atmId || "").trim();
  const labour_id = String(payload?.labourId || "").trim();
  const mobile = normalizeMobileForApi(payload?.countryCode, payload?.mobile);
  return {
    name: String(payload?.name || "").trim(),
    date_of_birth: String(payload?.dob || "").trim(),
    gender: mapGenderForApi(payload?.gender),
    mobile,
    email: String(payload?.email || "").trim(),
    barcode: String(payload?.mappedBarcode || "").trim(),
    labour_id,
    kiosk_id,
    adhaar_number: String(payload?.aadhaar || "").trim(),
    ayushman_card_number: payload?.ayushmanCard
      ? String(payload?.ayushmanCardNumber || "").trim()
      : "",
    address: String(payload?.address || "").trim(),
  };
}

function assertGetLabourOk(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response from server.");
  }
  if (data.success === false) {
    const msg =
      data.message ||
      (data.errors && typeof data.errors === "object" && JSON.stringify(data.errors)) ||
      "Could not load labour data.";
    throw new Error(typeof msg === "string" ? msg : "Could not load labour data.");
  }
}

function assertRegisterOk(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid response from server.");
  }
  if (data.status === false || data.success === false) {
    const msg = data.message || data.error || "Registration failed.";
    throw new Error(typeof msg === "string" ? msg : "Registration failed.");
  }
  if (data.status !== true && data.success !== true) {
    throw new Error(data.message || "Registration could not be confirmed.");
  }
}

export async function fetchLabourById(labourId, options = {}) {
  const id = String(labourId || "").trim();
  if (!id) {
    throw new Error("Labour ID is required.");
  }
  const atmId = String(options.atmId || "").trim();
  if (!atmId) {
    throw new Error("ATM ID is missing. Refresh the page and enter your ATM ID.");
  }

  const data = await postJson("/v1/camp/uk-bocw/get-labour-data", { lab_reg_no: id });
  assertGetLabourOk(data);

  const row = data.data;
  if (!row || typeof row !== "object") {
    throw new Error("No labour data returned.");
  }

  if (import.meta.env.DEV) {
    console.info("[YoloHealth get-labour-data]", { lab_reg_no: id, atmId });
  }

  return normalizeFromLabourApiRow(row, id);
}

export async function submitLabourRegistration(payload) {
  if (!String(payload?.atmId || "").trim()) {
    throw new Error("ATM ID is required to submit.");
  }

  const body = buildRegisterPatientBody(payload);
  const data = await postJson("/v1/camp/uk-bocw/register-patient", body);
  assertRegisterOk(data);

  if (import.meta.env.DEV) {
    console.info("[YoloHealth register-patient]", body);
  }

  return data ?? { ok: true };
}
