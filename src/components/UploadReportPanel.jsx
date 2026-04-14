import { lazy, Suspense, useCallback, useState } from "react";
import { loginWithBarcode } from "../api/loginBarcodeService.js";
import {
  inferReportFileType,
  readFileAsDataUri,
  uploadPatientReport,
} from "../api/uploadPatientReportService.js";
import {
  clearReportUploadSession,
  readReportUploadSession,
  writeReportUploadSession,
} from "../constants/storage.js";

const BarcodeScanModal = lazy(() => import("./BarcodeScanModal.jsx"));

const BARCODE_RE = /^[A-Za-z0-9\-]{3,64}$/;
const TITLE_MAX = 200;
const CATEGORY_MAX = 120;

function cleanBarcode(raw) {
  return String(raw ?? "")
    .replace(/[^A-Za-z0-9\-]/g, "")
    .slice(0, 64);
}

function profileDisplayName(profile) {
  if (!profile || typeof profile !== "object") return "";
  const full = String(profile.full_name || profile.name || "").trim();
  if (full) return full;
  const first = String(profile.first_name || "").trim();
  const last = String(profile.last_name || "").trim();
  return [first, last].filter(Boolean).join(" ").trim();
}

/**
 * Report upload: barcode login (`/v1/login-barcode`), then upload to `/v1/user-app/upload-patient-reports`.
 */
export default function UploadReportPanel({ atmId = "" }) {
  const [session, setSession] = useState(() => readReportUploadSession());
  const [barcode, setBarcode] = useState("");
  const [barcodeScanOpen, setBarcodeScanOpen] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");

  const onScanDetected = useCallback((code) => {
    const cleaned = cleanBarcode(code);
    setBarcode(cleaned);
    setBarcodeScanOpen(false);
    setLoginError("");
  }, []);

  const submitLogin = useCallback(async () => {
    const trimmed = String(barcode).trim();
    setLoginError("");
    if (!trimmed) {
      setLoginError("Barcode is required.");
      return;
    }
    if (!BARCODE_RE.test(trimmed)) {
      setLoginError("Use 3–64 characters: letters, digits, or hyphens.");
      return;
    }
    setLoginLoading(true);
    try {
      const res = await loginWithBarcode(trimmed);
      const data = res?.data;
      const authToken = data && typeof data === "object" ? data.token : null;
      const profile = data && typeof data === "object" ? data.profile : null;
      if (typeof authToken !== "string" || !authToken.trim()) {
        throw new Error("Login response did not include a token.");
      }
      const nextSession = {
        barcode: trimmed,
        authToken: authToken.trim(),
        profile: profile && typeof profile === "object" ? profile : null,
      };
      setSession(nextSession);
      writeReportUploadSession(nextSession);
      setTitle("");
      setCategory("");
      setFile(null);
      setFileInputKey((k) => k + 1);
      setUploadError("");
      setUploadSuccess("");
    } catch (e) {
      setLoginError(e?.message || "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  }, [barcode]);

  const signOut = useCallback(() => {
    clearReportUploadSession();
    setSession(null);
    setBarcode("");
    setTitle("");
    setCategory("");
    setFile(null);
    setFileInputKey((k) => k + 1);
    setUploadError("");
    setUploadSuccess("");
    setLoginError("");
  }, []);

  const onFileChange = useCallback((e) => {
    const f = e.target.files?.[0];
    setFile(f ?? null);
    setUploadError("");
    setUploadSuccess("");
  }, []);

  const onUploadSubmit = useCallback(
    async (e) => {
      e.preventDefault();
      setUploadError("");
      setUploadSuccess("");
      if (!session?.authToken) {
        setUploadError("Not signed in.");
        return;
      }
      const titleTrim = String(title).trim();
      const categoryTrim = String(category).trim();
      if (!titleTrim) {
        setUploadError("Title is required.");
        return;
      }
      if (titleTrim.length > TITLE_MAX) {
        setUploadError(`Title must be at most ${TITLE_MAX} characters.`);
        return;
      }
      if (!categoryTrim) {
        setUploadError("Category is required.");
        return;
      }
      if (categoryTrim.length > CATEGORY_MAX) {
        setUploadError(`Category must be at most ${CATEGORY_MAX} characters.`);
        return;
      }
      if (!file) {
        setUploadError("Choose a file to upload.");
        return;
      }
      const fileType = inferReportFileType(file);
      if (!fileType) {
        setUploadError("Use a PDF or a supported image (e.g. JPG, PNG, WEBP, GIF).");
        return;
      }

      setUploading(true);
      try {
        const file_path = await readFileAsDataUri(file);
        const json = await uploadPatientReport(session.authToken, {
          title: titleTrim,
          file_path,
          file_type: fileType,
          category: categoryTrim,
        });
        const msg =
          json && typeof json.message === "string" && json.message.trim()
            ? json.message.trim()
            : "Report saved successfully.";
        setUploadSuccess(msg);
        setFile(null);
        setFileInputKey((k) => k + 1);
      } catch (err) {
        setUploadError(err?.message || "Upload failed.");
      } finally {
        setUploading(false);
      }
    },
    [session, title, category, file],
  );

  const displayName = session ? profileDisplayName(session.profile) : "";

  return (
    <div className="upload-report-panel scan-test-panel">
      {!session ? (
        <div className="form-card scan-test-panel__card">
          <h1 className="form-card__title scan-test-panel__title">Upload report</h1>
          <p className="scan-test-panel__intro">
            Sign in with your patient barcode. After login you can upload your report
            to the server.
          </p>

          <div className="field field--full">
            <label className="field-label" htmlFor="upload-report-login-barcode">
              Barcode <span className="req">*</span>
            </label>
            <input
              id="upload-report-login-barcode"
              type="text"
              className="input"
              autoComplete="off"
              maxLength={64}
              enterKeyHint="go"
              value={barcode}
              onChange={(e) => setBarcode(cleanBarcode(e.target.value))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitLogin();
                }
              }}
              aria-required="true"
              aria-invalid={loginError ? "true" : "false"}
              aria-describedby={loginError ? "upload-report-login-error" : undefined}
              placeholder="e.g. 1234567890"
            />
            <div className="barcode-actions scan-test-panel__actions">
              <button type="button" className="btn btn-scan" onClick={() => setBarcodeScanOpen(true)}>
                Scan with camera
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={loginLoading || !BARCODE_RE.test(barcode.trim())}
                onClick={submitLogin}
              >
                {loginLoading ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </div>

          {loginError ? (
            <p id="upload-report-login-error" className="field-error scan-test-panel__error" role="alert">
              {loginError}
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <div className="form-card scan-test-panel__card upload-report-panel__session">
            <div className="upload-report-panel__session-row">
              <p className="upload-report-panel__session-text">
                Signed in{displayName ? (
                  <>
                    {" "}
                    as <strong>{displayName}</strong>
                  </>
                ) : null}{" "}
                · Barcode <strong>{session.barcode}</strong>
                {/* {atmId ? (
                  <>
                    {" "}
                    · Kiosk <strong>{atmId}</strong>
                  </>
                ) : null} */}
              </p>
              <button type="button" className="btn btn-ghost upload-report-panel__sign-out" onClick={signOut}>
                Sign out
              </button>
            </div>
          </div>

          <div className="form-card scan-test-panel__card">
            <h2 className="form-card__title scan-test-panel__title upload-report-panel__form-title">Upload report</h2>
            <form className="upload-report-panel__form" onSubmit={onUploadSubmit} noValidate>
              <div className="field">
                <label className="field-label" htmlFor="upload-report-title">
                  Title <span className="req">*</span>
                </label>
                <input
                  id="upload-report-title"
                  type="text"
                  className="input"
                  autoComplete="off"
                  maxLength={TITLE_MAX}
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setUploadError("");
                    setUploadSuccess("");
                  }}
                  placeholder="e.g. Lab report March 2026"
                  aria-required="true"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="upload-report-category">
                  Category <span className="req">*</span>
                </label>
                <input
                  id="upload-report-category"
                  type="text"
                  className="input"
                  autoComplete="off"
                  maxLength={CATEGORY_MAX}
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setUploadError("");
                    setUploadSuccess("");
                  }}
                  placeholder="e.g. pathology, X-ray"
                  aria-required="true"
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="upload-report-file">
                  File <span className="req">*</span>
                </label>
                <input
                  key={fileInputKey}
                  id="upload-report-file"
                  name="file"
                  type="file"
                  className="input upload-report-panel__file"
                  accept="application/pdf,.pdf,image/*"
                  onChange={onFileChange}
                />
                {file ? (
                  <p className="field-hint" aria-live="polite">
                    Selected: {file.name} ({Math.round(file.size / 1024)} KB) · type{" "}
                    <strong>{inferReportFileType(file) || "—"}</strong>
                  </p>
                ) : null}
              </div>

             <div style={{ marginTop: '1rem' }}>
             {uploadError ? (
                <p className="field-error upload-report-panel__status" role="alert">
                  {uploadError}
                </p>
              ) : null}
              {uploadSuccess ? (
                <p className="banner banner--success upload-report-panel__status" role="status">
                  {uploadSuccess}
                </p>
              ) : null}
             </div>

              <div className="upload-report-panel__actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={uploading || !title.trim() || !category.trim() || !file}
                  style={{ marginTop: '1rem',width: '100%' }}
                >
                  {uploading ? "Uploading…" : "Upload report"}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {barcodeScanOpen ? (
        <Suspense fallback={null}>
          <BarcodeScanModal
            open
            title="Scan barcode to sign in"
            onClose={() => setBarcodeScanOpen(false)}
            onDetected={(code) => {
              onScanDetected(code);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
