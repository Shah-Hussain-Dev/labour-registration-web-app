import { createPortal } from "react-dom";
import { formatAadhaarGrouped } from "../api/labourService.js";

export default function PreviewModal({ open, values, onBack, onConfirm, submitting }) {
  if (!open || !values) return null;

  const genderLabel = {
    male: "Male",
    female: "Female",
    other: "Other",
    prefer_not: "Prefer not to say",
  }[values.gender] || values.gender || "—";

  let dobDisplay = values.dob || "—";
  if (values.dob && /^\d{4}-\d{2}-\d{2}$/.test(values.dob)) {
    const [y, m, d] = values.dob.split("-");
    const dt = new Date(Number(y), Number(m) - 1, Number(d));
    if (!Number.isNaN(dt.getTime())) {
      dobDisplay = dt.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }

  const rows = [
    ["ATM ID", values.atmId || "—"],
    ["Labour ID", values.labourId],
    ["Name", values.name],
    ["Mobile", `${values.countryCode || ""} ${values.mobile || ""}`.trim()],
    ["Aadhaar", formatAadhaarGrouped(values.aadhaar) || "—"],
    ["Email", values.email || "—"],
    ["Address", String(values.address || "").trim() || "—"],
    ["Date of birth", dobDisplay],
    ["Gender", genderLabel],
    ["Ayushman card", values.ayushmanCard ? "Yes" : "No"],
    ...(values.ayushmanCard
      ? [["Ayushman card number", String(values.ayushmanCardNumber || "").trim() || "—"]]
      : []),
    ["Barcode", values.mappedBarcode || "—"],
  ];

  const content = (
    <div className="modal-root" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div className="modal-backdrop" onClick={submitting ? undefined : onBack} />
      <div className="modal-panel">
        <h2 id="preview-title" className="modal-title">
          Review before submitting
        </h2>
        <p className="modal-lead">Check that everything looks correct. You can go back to edit.</p>
        <dl className="preview-list">
          {rows.map(([label, val]) => (
            <div key={label} className="preview-row">
              <dt>{label}</dt>
              <dd>{val}</dd>
            </div>
          ))}
        </dl>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onBack} disabled={submitting}>
            Back to edit
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
            {submitting ? "Submitting…" : "Confirm & register"}
          </button>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
