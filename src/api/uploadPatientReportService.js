import { HEALTH_ATM_API_BASE_URL } from "../constants/healthAtmApiBase.js";

const UPLOAD_URL = `${HEALTH_ATM_API_BASE_URL}/v1/user-app/upload-patient-reports`;

/** MIME for `file_path` data URI (must match API `file_type`). */
const DATA_URI_MIME_BY_FILE_TYPE = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  tiff: "image/tiff",
  heic: "image/heic",
};

/**
 * Full data URI for `file_path`: `data:<mediatype>;base64,<data>` (e.g. `data:application/pdf;base64,…`).
 * @param {File} file
 * @returns {Promise<string>}
 */
export function readFileAsDataUri(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const comma = raw.indexOf(",");
      if (comma < 0 || !raw.startsWith("data:")) {
        reject(new Error("Could not read file."));
        return;
      }
      const b64 = raw.slice(comma + 1);
      if (!b64) {
        reject(new Error("Could not read file."));
        return;
      }
      const ft = inferReportFileType(file);
      let mime = ft ? DATA_URI_MIME_BY_FILE_TYPE[ft] : "";
      if (!mime && ft && /^[a-z0-9]+$/.test(ft)) {
        mime = `image/${ft}`;
      }
      if (!mime) {
        reject(new Error("Could not build data URI for this file type."));
        return;
      }
      resolve(`data:${mime};base64,${b64}`);
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

/**
 * Maps file to API `file_type` (pdf or image subtype). Empty string if unsupported.
 * @param {File} file
 * @returns {string}
 */
export function inferReportFileType(file) {
  const mime = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();

  if (mime === "application/pdf" || name.endsWith(".pdf")) return "pdf";

  const isImageMime = mime.startsWith("image/");
  if (!isImageMime && !/\.(jpe?g|png|gif|webp|bmp|tiff?|heic|heif)$/.test(name)) {
    return "";
  }

  if (mime === "image/jpeg" || mime === "image/jpg" || name.endsWith(".jpg") || name.endsWith(".jpeg")) {
    return "jpg";
  }
  if (mime === "image/png" || name.endsWith(".png")) return "png";
  if (mime === "image/gif" || name.endsWith(".gif")) return "gif";
  if (mime === "image/webp" || name.endsWith(".webp")) return "webp";
  if (mime === "image/bmp" || name.endsWith(".bmp")) return "bmp";
  if (mime === "image/tiff" || name.endsWith(".tif") || name.endsWith(".tiff")) return "tiff";
  if (
    mime === "image/heic" ||
    mime === "image/heif" ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  ) {
    return "heic";
  }

  if (isImageMime) {
    const sub = mime.slice("image/".length).split(";")[0].trim();
    if (!sub || sub === "svg+xml") return "";
    if (sub === "jpeg" || sub === "pjpeg") return "jpg";
    if (/^[a-z0-9+.-]+$/.test(sub) && sub.length <= 12) {
      return sub.replace(/\+/g, "");
    }
  }

  return "";
}

/**
 * @param {string} authToken JWT from `POST /v1/login-barcode` → `data.token`.
 * @param {{ title: string, file_path: string, file_type: string, category: string }} body — `file_path` is a full data URI (`data:…;base64,…`).
 */
export async function uploadPatientReport(authToken, body) {
  const t = String(authToken || "").trim();
  if (!t) {
    throw new Error("Not signed in. Scan your barcode again.");
  }

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${t}`,
    },
    body: JSON.stringify({
      title: String(body.title || "").trim(),
      file_path: String(body.file_path || ""),
      file_type: String(body.file_type || "")
        .trim()
        .toLowerCase(),
      category: String(body.category || "").trim(),
    }),
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
    throw new Error(serverMsg || text || `Upload failed (${res.status}).`);
  }
  if (json && json.status === false) {
    throw new Error(serverMsg || "Upload failed.");
  }
  if (json && json.success === false) {
    throw new Error(serverMsg || "Upload failed.");
  }

  return json ?? { status: true };
}
