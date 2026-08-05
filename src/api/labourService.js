/**
 * UK BOCW camp APIs — uses native fetch only.
 * Base URL: {@link HEALTH_ATM_API_BASE_URL}
 */
import { HEALTH_ATM_API_BASE_URL } from "../constants/healthAtmApiBase.js";
import { normalizeBarcodePrefix } from "../constants/storage.js";
import { dobDisplayToIso, dobIsoToDisplay } from "../validation/labourRegistrationSchema.js";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat.js";

dayjs.extend(customParseFormat);

function apiRoot() {
  return HEALTH_ATM_API_BASE_URL;
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

/** Display Aadhaar as 4444-4444-4444; storage stays 12 digits only. */
export function formatAadhaarGrouped(raw) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  const g1 = d.slice(0, 4);
  const g2 = d.slice(4, 8);
  const g3 = d.slice(8, 12);
  const parts = [g1];
  if (g2.length > 0) parts.push(g2);
  if (g3.length > 0) parts.push(g3);
  return parts.join("-");
}

/**
 * Mask Aadhaar as ••••-••••-1234 (last four digits visible).
 * When revealLastDigit is true (typing with mask on), only the last entered digit stays visible;
 * earlier digits are masked immediately.
 */
export function formatAadhaarMasked(raw, { revealLastDigit = false } = {}) {
  const d = String(raw || "").replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  const display = d
    .split("")
    .map((digit, i) => {
      if (i < 8) {
        return revealLastDigit && i === d.length - 1 ? digit : "•";
      }
      return digit;
    })
    .join("");
  const g1 = display.slice(0, 4);
  const g2 = display.slice(4, 8);
  const g3 = display.slice(8, 12);
  const parts = [g1];
  if (d.length > 4) parts.push(g2);
  if (d.length > 8) parts.push(g3);
  return parts.join("-");
}

/** Same values as UK BOCW MemberRelation / member_relation on family records. */
export const MEMBER_RELATION_OPTIONS = [
  "Self",
  "Wife",
  "Father",
  "Mother",
  "Son",
  "Daughter",
];

export const DEFAULT_MEMBER_RELATION = "Self";

function readMemberRelation(raw) {
  return String(raw.MemberRelation ?? raw.Relation ?? raw.member_relation ?? "").trim();
}

function formatDobToIso(dobStr) {
  if (typeof dobStr !== "string") return "";
  const clean = dobStr.trim();
  if (!clean) return "";

  let d = dayjs(clean, ["DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD"], true);
  if (!d.isValid()) {
    d = dayjs(clean);
  }

  if (d.isValid()) {
    return d.format("YYYY-MM-DD");
  }

  return clean;
}

function normalizeFromLabourApiRow(raw, fallbackLabRegNo) {
  const labourId = String(
    raw.LabRegNo ?? raw.lab_reg_no ?? raw.labour_id ?? raw.LabourId ?? fallbackLabRegNo ?? "",
  ).trim();

  const dobRaw = raw.Dob ?? raw.dob ?? raw.date_of_birth ?? "";
  const dobIso = formatDobToIso(dobRaw);
  const dob = dobIso ? dobIsoToDisplay(dobIso) : "";

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
    mappedBarcode: "",
    memberRelation: readMemberRelation(raw),
  };
}

/** Optional age from API when DOB is missing (e.g. Family.Age). */
function parseOptionalAgeYears(value) {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (s === "") return null;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 0 || n > 150) return null;
  return n;
}

function familyMemberSelectLabel(raw) {
  const name = String(raw.LabourName ?? raw.Name ?? raw.name ?? "").trim() || "Member";
  const rel = String(raw.MemberRelation ?? raw.Relation ?? raw.member_relation ?? "").trim();
  return rel ? `${name} (${rel})` : name;
}

/** Map a Family[] item to the same form shape as the main labour row. */
function normalizeFromFamilyApiRow(raw, fallbackLabRegNo) {
  const pseudo = {
    ...raw,
    LabourName: raw.LabourName ?? raw.Name ?? raw.name ?? "",
    MobileNo: raw.Mobileno ?? raw.MobileNo ?? raw.mobile ?? "",
    LabRegNo: raw.LabRegNo ?? raw.lab_reg_no ?? fallbackLabRegNo ?? "",
    Gender: raw.Gender ?? raw.gender ?? "",
    Dob: raw.Dob ?? raw.dob ?? raw.date_of_birth ?? "",
    AadharNo: raw.AadharNo ?? raw.aadhaar ?? raw.adhaar_number ?? "",
    Address: raw.Address ?? raw.address ?? "",
  };
  return normalizeFromLabourApiRow(pseudo, fallbackLabRegNo);
}

/** Combine optional letter prefix with mapped barcode before API submit. */
export function resolveRegistrationBarcode(mappedBarcode, barcodePrefix = "") {
  const prefix = normalizeBarcodePrefix(barcodePrefix);
  const raw = String(mappedBarcode ?? "").trim();
  if (!prefix) return raw;
  if (raw.toUpperCase().startsWith(prefix)) return raw;
  const suffix = raw.replace(/\D/g, "");
  return `${prefix}${suffix}`;
}

export function buildRegisterPatientBody(payload) {
  const kiosk_id = String(payload?.atmId || "").trim();
  const labour_id = String(payload?.labourId || "").trim();
  const mobile = normalizeMobileForApi(payload?.countryCode, payload?.mobile);
  return {
    name: String(payload?.name || "").trim(),
    date_of_birth: dobDisplayToIso(payload?.dob) || String(payload?.dob || "").trim(),
    address: String(payload?.address || "").trim(),
    gender: mapGenderForApi(payload?.gender),
    mobile,
    email: String(payload?.email || "").trim(),
    barcode: resolveRegistrationBarcode(payload?.mappedBarcode, payload?.barcodePrefix),
    labour_id,
    kiosk_id,
    adhaar_number: String(payload?.aadhaar || "").trim(),
    member_relation: String(payload?.memberRelation || "").trim(),
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

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read photo."));
    reader.readAsDataURL(blob);
  });
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

  const payload = data.data;
  if (!payload || typeof payload !== "object") {
    throw new Error("No labour data returned.");
  }

  const labourRow = payload.Labour ?? payload;
  if (!labourRow || typeof labourRow !== "object") {
    throw new Error("No labour data returned.");
  }

  const familyRaw = Array.isArray(payload.Family) ? payload.Family : [];

  if (import.meta.env.DEV) {
    console.info("[YoloHealth get-labour-data]", { lab_reg_no: id, atmId });
  }

  const main = normalizeFromLabourApiRow(labourRow, id);
  const regNo = main.labourId || id;
  const mainCardAgeYears = parseOptionalAgeYears(labourRow.Age ?? labourRow.age);
  const familyOptions = familyRaw
    .map((m) => {
      const familyRecordId = String(m.FamilyRecordId ?? m.family_record_id ?? "").trim();
      return {
        familyRecordId,
        label: familyMemberSelectLabel(m),
        form: normalizeFromFamilyApiRow(m, regNo),
        cardAgeYears: parseOptionalAgeYears(m.Age ?? m.age),
      };
    })
    .filter((o) => o.familyRecordId);

  return { main, mainCardAgeYears, familyOptions };
}

export async function submitLabourRegistration(payload) {
  if (!String(payload?.atmId || "").trim()) {
    throw new Error("ATM ID is required to submit.");
  }

  const base = buildRegisterPatientBody(payload);
  const photo = payload?.geoTaggedPhoto;
  if (!(photo instanceof Blob)) {
    throw new Error("Labour live photo is required to submit.");
  }

  const photoDataUrl = await readBlobAsDataUrl(photo);
  const liveLocationTrim = String(payload?.geoPhotoMeta?.address ?? "").trim();

  const body = {
    name: base.name,
    date_of_birth: base.date_of_birth,
    address: base.address,
    gender: base.gender,
    mobile: base.mobile,
    email: base.email,
    barcode: base.barcode,
    labour_id: base.labour_id,
    kiosk_id: base.kiosk_id,
    adhaar_number: base.adhaar_number,
    ...(base.member_relation ? { member_relation: base.member_relation } : {}),
    ...(liveLocationTrim ? { live_location: liveLocationTrim } : {}),
    photo: photoDataUrl,
  };

  if (import.meta.env.DEV) {
    const { photo: photoLog, ...rest } = body;
    console.info("[YoloHealth register-patient]", {
      ...rest,
      ...(photoLog != null ? { photo: `[data URL ${String(photoLog).length} chars]` } : {}),
    });
  }

  const data = await postJson("/v1/camp/uk-bocw/register-patient", body);

  assertRegisterOk(data);

  return data ?? { ok: true };
}
