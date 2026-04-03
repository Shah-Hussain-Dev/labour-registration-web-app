import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  fetchLabourById,
  normalizeMobileForApi,
  submitLabourRegistration,
} from "../api/labourService.js";
import PreviewModal from "./PreviewModal.jsx";

const BarcodeScanModal = lazy(() => import("./BarcodeScanModal.jsx"));

const emptyForm = () => ({
  labourId: "",
  name: "",
  countryCode: "+91",
  mobile: "",
  aadhaar: "",
  email: "",
  address: "",
  dob: "",
  gender: "",
  ayushmanCard: false,
  ayushmanCardNumber: "",
  mappedBarcode: "",
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LABOUR_ID_RE = /^[\dA-Za-z\-]{4,32}$/;
const BARCODE_RE = /^[A-Za-z0-9\-]{3,64}$/;
const AYUSHMAN_RE = /^[\dA-Za-z\-]{3,50}$/;
const NAME_MAX = 150;
const ADDRESS_MAX = 500;

function validateDob(iso) {
  if (!String(iso || "").trim()) return "Date of birth is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Enter a valid date";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return "Date of birth cannot be in the future";
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  if (age < 10) return "Patient must be at least 10 years old";
  if (age > 120) return "Please check the date of birth";
  return "";
}

function validateLabourForm(f) {
  const err = {};
  const labourId = String(f.labourId || "").trim();
  if (!labourId) err.labourId = "Labour ID is required";
  else if (!LABOUR_ID_RE.test(labourId)) err.labourId = "Use 4–32 letters, digits, or hyphens";

  const name = String(f.name || "").trim();
  if (!name) err.name = "Name is required";
  else if (name.length < 2) err.name = "Name must be at least 2 characters";
  else if (name.length > NAME_MAX) err.name = `Name must be at most ${NAME_MAX} characters`;

  const aadhaar = String(f.aadhaar || "").replace(/\s/g, "");
  if (!aadhaar) err.aadhaar = "Aadhaar is required";
  else if (!/^\d{12}$/.test(aadhaar)) err.aadhaar = "Enter exactly 12 digits";

  const email = String(f.email || "").trim();
  if (email && !EMAIL_RE.test(email)) err.email = "Enter a valid email address";

  const address = String(f.address || "");
  if (address.length > ADDRESS_MAX) {
    err.address = `Address must be at most ${ADDRESS_MAX} characters`;
  }

  const dobErr = validateDob(String(f.dob || "").trim());
  if (dobErr) err.dob = dobErr;

  if (!String(f.gender || "").trim()) err.gender = "Select gender";

  const ccForMobile = String(f.countryCode || "+91").trim();
  const ccBare = ccForMobile.replace(/^\+/, "");
  const mobileTrim = String(f.mobile || "").trim();
  if (mobileTrim) {
    if (!ccBare) err.countryCode = "Country code is required when mobile is entered";
    else if (!/^\d{1,4}$/.test(ccBare)) err.countryCode = "Use digits only (e.g. 91)";

    if (!err.countryCode) {
      const digits = normalizeMobileForApi(ccForMobile, f.mobile);
      if (ccBare === "91" || ccBare === "") {
        if (!/^\d{10}$/.test(digits)) err.mobile = "Enter a valid 10-digit Indian mobile number";
      } else if (digits.length < 8 || digits.length > 15) {
        err.mobile = "Enter 8–15 digits for this country code";
      }
    }
  }

  if (f.ayushmanCard) {
    const acn = String(f.ayushmanCardNumber || "").trim();
    if (!acn) err.ayushmanCardNumber = "Ayushman card number is required";
    else if (!AYUSHMAN_RE.test(acn)) err.ayushmanCardNumber = "Use 3–50 letters, digits, or hyphens";
  }

  const barcode = String(f.mappedBarcode || "").trim();
  if (!barcode) err.mappedBarcode = "Barcode is required";
  else if (!BARCODE_RE.test(barcode)) err.mappedBarcode = "Use 3–64 characters: letters, digits, or hyphens";

  return err;
}

function isLabourFormComplete(f) {
  return Object.keys(validateLabourForm(f)).length === 0;
}

export default function LabourRegistrationForm({ atmId = "" }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [loadingLabour, setLoadingLabour] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewValues, setPreviewValues] = useState(null);
  const wasPreviewOpenRef = useRef(false);

  useEffect(() => {
    if (wasPreviewOpenRef.current && !previewOpen) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    wasPreviewOpenRef.current = previewOpen;
  }, [previewOpen]);
  const [finalSubmitting, setFinalSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [barcodeScanOpen, setBarcodeScanOpen] = useState(false);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  }

  async function onLoadLabour() {
    setLoadError("");
    setSuccessMsg("");
    setSubmitError("");
    const id = String(form.labourId || "").trim();
    if (!id) {
      setLoadError("Enter a Labour ID first.");
      return;
    }
    setLoadingLabour(true);
    try {
      const data = await fetchLabourById(id, { atmId });
      setForm({
        ...emptyForm(),
        ...data,
        labourId: data.labourId || id,
      });
      setErrors({});
      setLoaded(true);
    } catch (e) {
      setLoaded(false);
      setLoadError(e.message || "Something went wrong.");
    } finally {
      setLoadingLabour(false);
    }
  }

  function onFormSubmit(e) {
    e.preventDefault();
    if (!loaded) return;
    const nextErrors = validateLabourForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstKey = Object.keys(nextErrors)[0];
      const el = document.getElementById(
        firstKey === "labourId"
          ? "labourId"
          : firstKey === "ayushmanCardNumber"
            ? "ayushmanCardNumber"
            : firstKey === "countryCode"
              ? "countryCode"
              : firstKey,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus?.();
      return;
    }
    setPreviewValues({ ...form, atmId });
    setPreviewOpen(true);
  }

  async function onConfirmRegister() {
    if (!previewValues) return;
    setFinalSubmitting(true);
    setSuccessMsg("");
    setSubmitError("");
    try {
      await submitLabourRegistration({
        atmId: previewValues.atmId,
        labourId: previewValues.labourId,
        name: previewValues.name,
        countryCode: previewValues.countryCode,
        mobile: previewValues.mobile,
        aadhaar: previewValues.aadhaar,
        email: previewValues.email,
        dob: previewValues.dob,
        gender: previewValues.gender,
        ayushmanCard: previewValues.ayushmanCard,
        ayushmanCardNumber: previewValues.ayushmanCard
          ? String(previewValues.ayushmanCardNumber || "").trim()
          : "",
        mappedBarcode: previewValues.mappedBarcode,
        address: String(previewValues.address || "").trim(),
      });
      setPreviewOpen(false);
      setPreviewValues(null);
      setSuccessMsg("Registration submitted successfully.");
      setLoaded(false);
      setForm(emptyForm());
      setErrors({});
    } catch (e) {
      setPreviewOpen(false);
      setPreviewValues(null);
      setSubmitError(e.message || "Submission failed.");
    } finally {
      setFinalSubmitting(false);
    }
  }

  const labourIdTrimmed = String(form.labourId || "").trim();
  const canReviewSubmit = loaded && isLabourFormComplete(form);

  return (
    <>
      <form id="yh-labour-form" className="form-card" noValidate onSubmit={onFormSubmit}>
        <h1 className="form-card__title">
          {loaded && labourIdTrimmed
            ? `Register: ${labourIdTrimmed}`
            : "Labour registration"}
        </h1>
        {atmId ? (
          <p className="form-card__atm" aria-label="Current ATM ID">
            ATM ID: <strong>{atmId}</strong>
          </p>
        ) : null}

        {successMsg ? (
          <p className="banner banner--success" role="status">
            {successMsg}
          </p>
        ) : null}
        {submitError ? (
          <p className="banner banner--error" role="alert">
            {submitError}
          </p>
        ) : null}

        <section className="labour-id-block" aria-label="Labour lookup">
          <label className="field-label" htmlFor="labourId">
            Labour ID <span className="req">*</span>
          </label>
          <div className="labour-id-row">
            <input
              id="labourId"
              type="search"
              className="input"
              autoComplete="off"
              disabled={loadingLabour}
              value={form.labourId}
              onChange={(e) => updateField("labourId", e.target.value)}
              aria-invalid={errors.labourId ? "true" : "false"}
              aria-describedby={loadError ? "load-err" : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onLoadLabour();
                }
              }}
            />
            <button
              type="button"
              className="btn btn-load-details"
              onClick={onLoadLabour}
              disabled={loadingLabour}
            >
              {loadingLabour ? (
                <span className="inline-spinner" aria-hidden />
              ) : null}
              {loadingLabour ? "Loading…" : "Load details"}
            </button>
          </div>
          {errors.labourId ? <p className="field-error">{errors.labourId}</p> : null}
          {loadError ? (
            <p id="load-err" className="field-error" role="alert">
              {loadError}
            </p>
          ) : null}
          <p className="field-hint">
            Enter the labour registration number, then <strong>Load details</strong> to fetch data from the server.
          </p>
        </section>

        {loaded ? (
          <>
            <div className="labour-form">
              <div className="form-grid">
                <div className="field">
                  <label className="field-label" htmlFor="name">
                    Name <span className="req">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    className="input"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    aria-invalid={errors.name ? "true" : "false"}
                  />
                  {errors.name ? <p className="field-error">{errors.name}</p> : null}
                </div>

                <div className="field">
                  <span className="field-label" id="mobile-label">
                    Mobile
                  </span>
                  <div className="mobile-row" role="group" aria-labelledby="mobile-label">
                    <input
                      id="countryCode"
                      type="text"
                      inputMode="numeric"
                      className="input input--code"
                      aria-label="Country code"
                      aria-invalid={errors.countryCode ? "true" : "false"}
                      value={form.countryCode}
                      onChange={(e) => updateField("countryCode", e.target.value)}
                    />
                    <input
                      id="mobile"
                      type="tel"
                      className="input input--grow"
                      autoComplete="tel"
                      inputMode="numeric"
                      aria-invalid={errors.mobile ? "true" : "false"}
                      value={form.mobile}
                      onChange={(e) => updateField("mobile", e.target.value)}
                    />
                  </div>
                  {errors.countryCode ? <p className="field-error">{errors.countryCode}</p> : null}
                  {errors.mobile ? <p className="field-error">{errors.mobile}</p> : null}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="aadhaar">
                    Aadhaar number <span className="req">*</span>
                  </label>
                  <input
                    id="aadhaar"
                    type="text"
                    inputMode="numeric"
                    className="input"
                    autoComplete="off"
                    maxLength={12}
                    value={form.aadhaar}
                    onChange={(e) => updateField("aadhaar", e.target.value)}
                    aria-invalid={errors.aadhaar ? "true" : "false"}
                  />
                  {errors.aadhaar ? <p className="field-error">{errors.aadhaar}</p> : null}
                </div>

                <div className="field field--full form-row-email-address">
                  <div className="form-row-email-address__inner">
                    <div className="field form-row-email-address__email">
                      <label className="field-label" htmlFor="email">
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        className="input"
                        autoComplete="email"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value)}
                        aria-invalid={errors.email ? "true" : "false"}
                      />
                      {errors.email ? <p className="field-error">{errors.email}</p> : null}
                    </div>
                    <div className="field form-row-email-address__address">
                      <label className="field-label" htmlFor="address">
                        Address
                      </label>
                      <textarea
                        id="address"
                        className="input input--textarea"
                        rows={2}
                        autoComplete="street-address"
                        maxLength={ADDRESS_MAX}
                        value={form.address}
                        onChange={(e) => updateField("address", e.target.value)}
                        aria-invalid={errors.address ? "true" : "false"}
                      />
                      {errors.address ? <p className="field-error">{errors.address}</p> : null}
                    </div>
                  </div>
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="dob">
                    Date of birth <span className="req">*</span>
                  </label>
                  <input
                    id="dob"
                    type="date"
                    className="input"
                    value={form.dob}
                    onChange={(e) => updateField("dob", e.target.value)}
                    aria-invalid={errors.dob ? "true" : "false"}
                  />
                  {errors.dob ? <p className="field-error">{errors.dob}</p> : null}
                </div>

                <div className="field">
                  <label className="field-label" htmlFor="gender">
                    Gender <span className="req">*</span>
                  </label>
                  <select
                    id="gender"
                    className="input input--select"
                    value={form.gender}
                    onChange={(e) => updateField("gender", e.target.value)}
                    aria-invalid={errors.gender ? "true" : "false"}
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                    <option value="prefer_not">Prefer not to say</option>
                  </select>
                  {errors.gender ? <p className="field-error">{errors.gender}</p> : null}
                </div>

                <div className="field field--full span-barcode">
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={form.ayushmanCard}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setForm((prev) => ({
                          ...prev,
                          ayushmanCard: checked,
                          ayushmanCardNumber: checked ? prev.ayushmanCardNumber : "",
                        }));
                        if (errors.ayushmanCardNumber) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.ayushmanCardNumber;
                            return next;
                          });
                        }
                      }}
                    />
                    <span>Does the patient have an Ayushman card?</span>
                  </label>
                </div>

                {form.ayushmanCard ? (
                  <div className="field field--full span-barcode">
                    <label className="field-label" htmlFor="ayushmanCardNumber">
                      Ayushman card number <span className="req">*</span>
                    </label>
                    <input
                      id="ayushmanCardNumber"
                      type="text"
                      className="input"
                      autoComplete="off"
                      placeholder="Enter Ayushman card number"
                      value={form.ayushmanCardNumber}
                      onChange={(e) => updateField("ayushmanCardNumber", e.target.value)}
                      aria-invalid={errors.ayushmanCardNumber ? "true" : "false"}
                      aria-required="true"
                    />
                    {errors.ayushmanCardNumber ? (
                      <p className="field-error">{errors.ayushmanCardNumber}</p>
                    ) : null}
                  </div>
                ) : null}

                <div className="field span-barcode">
                  <label className="field-label" htmlFor="mappedBarcode">
                    Barcode <span className="req">*</span>
                  </label>
                  <input
                    id="mappedBarcode"
                    type="text"
                    className="input"
                    autoComplete="off"
                    maxLength={64}
                    enterKeyHint="done"
                    value={form.mappedBarcode}
                    onChange={(e) =>
                      updateField(
                        "mappedBarcode",
                        e.target.value.replace(/[^A-Za-z0-9\-]/g, "").slice(0, 64),
                      )
                    }
                    aria-invalid={errors.mappedBarcode ? "true" : "false"}
                    aria-required="true"
                  />
                  {errors.mappedBarcode ? <p className="field-error">{errors.mappedBarcode}</p> : null}
                  <div className="barcode-actions">
                    <button type="button" className="btn btn-scan" onClick={() => setBarcodeScanOpen(true)}>
                      Scan with camera
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="form-footer">
              <button
                type="submit"
                className="btn btn-block btn-primary btn-submit-main"
                disabled={!canReviewSubmit}
                title={
                  canReviewSubmit
                    ? undefined
                    : "Fill every required field (red *), including a valid barcode."
                }
              >
                Review & submit
              </button>
            </div>
          </>
        ) : null}
      </form>

      {barcodeScanOpen ? (
        <Suspense fallback={null}>
          <BarcodeScanModal
            open
            onClose={() => setBarcodeScanOpen(false)}
            onDetected={(code) => {
              const cleaned = String(code).replace(/[^A-Za-z0-9\-]/g, "").slice(0, 64);
              updateField("mappedBarcode", cleaned);
              setBarcodeScanOpen(false);
            }}
          />
        </Suspense>
      ) : null}

      <PreviewModal
        open={previewOpen}
        values={previewValues}
        onBack={() => setPreviewOpen(false)}
        onConfirm={onConfirmRegister}
        submitting={finalSubmitting}
      />
    </>
  );
}
