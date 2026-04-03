import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { normalizeAtmId } from "../constants/storage.js";

const KIOSK_ID_RE = /^[A-Za-z0-9\-]{3,32}$/;

/**
 * First visit: blocking until ATM ID is saved. Change flow: can cancel to keep previous ID.
 */
export default function AtmIdModal({ open, blocking, initialAtmId, onSave, onClose }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setValue(normalizeAtmId(initialAtmId ?? ""));
      setError("");
    }
  }, [open, initialAtmId]);

  if (!open) return null;

  function handleSubmit(e) {
    e.preventDefault();
    const t = normalizeAtmId(value);
    if (!t) {
      setError("ATM ID is required.");
      return;
    }
    if (!KIOSK_ID_RE.test(t)) {
      setError("Use 3–32 letters, digits, or hyphens (e.g. UKHA001).");
      return;
    }
    onSave(t);
  }

  const content = (
    <div
      className={`modal-root atm-id-modal${blocking ? " modal-root--blocking" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="atm-modal-title"
    >
      <div className="modal-backdrop" onClick={blocking ? undefined : onClose} />
      <div className="modal-panel atm-id-modal__panel">
        <h2 id="atm-modal-title" className="modal-title">
          {blocking ? "Enter ATM ID" : "Change ATM ID"}
        </h2>
        <p className="modal-lead">
          {blocking
            ? "An ATM ID is required to use this registration app. It will be sent with every registration."
            : "Update the ATM ID for this device. It is stored locally and sent with each registration."}
        </p>
        <form onSubmit={handleSubmit} noValidate>
          <label className="field-label" htmlFor="atm-id-input">
            ATM ID <span className="req">*</span>
          </label>
          <input
            id="atm-id-input"
            type="text"
            className="input"
            autoComplete="off"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value.toUpperCase());
              if (error) setError("");
            }}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={error ? "atm-id-err" : undefined}
            placeholder="e.g. UKHA001"
          />
          {error ? (
            <p id="atm-id-err" className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className={`modal-actions atm-id-modal__actions${blocking ? " atm-id-modal__actions--single" : ""}`}>
            {!blocking ? (
              <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
                Cancel
              </button>
            ) : null}
            <button type="submit" className="btn btn-primary btn-block">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return createPortal(content, document.body);
  }
  return content;
}
