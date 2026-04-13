import { lazy, Suspense, useCallback, useState } from "react";
import { fetchAdditionalTests, markAdditionalTestsDone } from "../api/additionalTestsService.js";

const BarcodeScanModal = lazy(() => import("./BarcodeScanModal.jsx"));

const BARCODE_RE = /^[A-Za-z0-9\-]{3,64}$/;

function cleanBarcode(raw) {
  return String(raw ?? "")
    .replace(/[^A-Za-z0-9\-]/g, "")
    .slice(0, 64);
}

function isValidTestRow(t) {
  return (
    t &&
    typeof t === "object" &&
    typeof t.id === "number" &&
    String(t.medical_service_name || "").trim().length > 0
  );
}

/** List active, completed, and any non-inactive row; hide only `status === inactive`. */
function isListedTestRow(t) {
  return String(t?.status ?? "")
    .trim()
    .toLowerCase() !== "inactive";
}

function formatWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function statusChipClass(status) {
  const s = String(status || "").toLowerCase();
  if (s === "active") return "scan-test-card__status--active";
  if (s === "inactive") return "scan-test-card__status--inactive";
  return "scan-test-card__status--muted";
}

function applyMarkedDone(prev, ids) {
  const idSet = new Set(ids);
  return prev.map((row) => (idSet.has(row.id) ? { ...row, is_test_done: true } : row));
}

function ButtonWithSpinner({ busy, busyLabel, idleLabel }) {
  if (busy) {
    return (
      <span className="btn-inline-load">
        <span className="inline-spinner" aria-hidden />
        <span>{busyLabel}</span>
      </span>
    );
  }
  return idleLabel;
}

export default function ScanTestPanel() {
  const [barcode, setBarcode] = useState("");
  const [barcodeScanOpen, setBarcodeScanOpen] = useState(false);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [markError, setMarkError] = useState("");
  const [lastLoadedCount, setLastLoadedCount] = useState(null);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  /** Single-card mark API in flight (row id). */
  const [markPendingId, setMarkPendingId] = useState(null);
  /** Batch submit (2+ checkboxes) in flight. */
  const [markBatchPending, setMarkBatchPending] = useState(false);

  const markBusy = markPendingId != null || markBatchPending;

  const loadTests = useCallback(async (code) => {
    const trimmed = String(code ?? "").trim();
    setError("");
    setMarkError("");
    if (!trimmed) {
      setError("Barcode is required.");
      setTests([]);
      setLastLoadedCount(null);
      return;
    }
    if (!BARCODE_RE.test(trimmed)) {
      setError("Use 3–64 characters: letters, digits, or hyphens.");
      setTests([]);
      return;
    }
    setLoading(true);
    setTests([]);
    setLastLoadedCount(null);
    setSelectedIds(new Set());
    try {
      const list = await fetchAdditionalTests(trimmed);
      const rows = list.filter(isValidTestRow).filter(isListedTestRow);
      rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
      setTests(rows);
      setLastLoadedCount(rows.length);
    } catch (e) {
      setError(e?.message || "Could not load additional tests.");
      setTests([]);
      setLastLoadedCount(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const onScanDetected = useCallback(
    (code) => {
      const cleaned = cleanBarcode(code);
      setBarcode(cleaned);
      setBarcodeScanOpen(false);
      if (BARCODE_RE.test(cleaned)) {
        loadTests(cleaned);
      } else {
        setError("Scanned value is not a valid barcode for this form.");
        setTests([]);
      }
    },
    [loadTests],
  );

  const markIds = useCallback(async (ids) => {
    setMarkError("");
    const batch = ids.length >= 2;
    if (batch) setMarkBatchPending(true);
    else setMarkPendingId(ids[0] ?? null);
    try {
      await markAdditionalTestsDone(ids);
      setTests((prev) => applyMarkedDone(prev, ids));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.delete(id);
        return next;
      });
    } catch (e) {
      setMarkError(e?.message || "Could not mark tests complete.");
    } finally {
      setMarkBatchPending(false);
      setMarkPendingId(null);
    }
  }, []);

  const toggleSelect = useCallback((id, done) => {
    if (done || markBusy) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setMarkError("");
  }, [markBusy]);

  const submitSelected = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    markIds(ids);
  }, [markIds, selectedIds]);

  const hasRows = tests.length > 0;
  const multiSelected = selectedIds.size >= 2;

  return (
    <div className="scan-test-panel">
      <div className="form-card scan-test-panel__card">
        <h1 className="form-card__title scan-test-panel__title">Scan and test</h1>
        <p className="scan-test-panel__intro">
          A patient barcode is required. Scan or type it, then load additional tests from the camp API. Rows with
          status <strong>inactive</strong> are hidden; active and completed tests are shown.
        </p>

        <div className="field field--full">
          <label className="field-label" htmlFor="scan-test-barcode">
            Barcode <span className="req">*</span>
          </label>
          <input
            id="scan-test-barcode"
            type="text"
            className="input"
            autoComplete="off"
            maxLength={64}
            enterKeyHint="search"
            value={barcode}
            onChange={(e) => setBarcode(cleanBarcode(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                loadTests(barcode);
              }
            }}
            aria-required="true"
            aria-invalid={
              error === "Barcode is required." ||
              error === "Use 3–64 characters: letters, digits, or hyphens." ||
              error === "Scanned value is not a valid barcode for this form."
                ? "true"
                : "false"
            }
            placeholder="e.g. BOCW2781"
          />
          <div className="barcode-actions scan-test-panel__actions">
            <button type="button" className="btn btn-scan" onClick={() => setBarcodeScanOpen(true)}>
              Scan with camera
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !BARCODE_RE.test(barcode.trim())}
              onClick={() => loadTests(barcode)}
            >
              {loading ? "Loading…" : "Load tests"}
            </button>
          </div>
        </div>

        {error ? (
          <p className="field-error scan-test-panel__error" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {hasRows ? (
        <section className="scan-test-list" aria-label="Additional tests">
          <h2 className="scan-test-list__heading">Additional Tests</h2>

          <ul className="scan-test-list__grid">
            {tests.map((t) => {
              const done = Boolean(t.is_test_done);
              const sc = statusChipClass(t.status);
              const checked = selectedIds.has(t.id);
              return (
                <li key={t.id} className={`scan-test-card${done ? " scan-test-card--done" : ""}`}>
                  <div className="scan-test-card__head">
                    <div className="scan-test-card__head-main">
                      <label className="scan-test-card__check-label">
                        <input
                          type="checkbox"
                          className="scan-test-card__checkbox"
                          checked={checked}
                          disabled={done || markBusy}
                          onChange={() => toggleSelect(t.id, done)}
                        />
                        <span className="scan-test-card__name">{t.medical_service_name}</span>
                      </label>
                    </div>
                    {done ? (
                      <span className="scan-test-card__status scan-test-card__status--completed">
                        Completed
                      </span>
                    ) : (
                      <span className={`scan-test-card__status ${sc}`}>{t.status || "—"}</span>
                    )}
                  </div>
                  <dl className="scan-test-card__meta">
                    <div className="scan-test-card__row">
                      <dt>Doctor</dt>
                      <dd>{t.doctor_name || "—"}</dd>
                    </div>
                    <div className="scan-test-card__row">
                      <dt>Recorded</dt>
                      <dd>{formatWhen(t.created_at)}</dd>
                    </div>
                  </dl>
                  <div className="scan-test-card__foot">
                    <button
                      type="button"
                      className="btn btn-primary btn-block scan-test-card__complete"
                      disabled={done || markBusy}
                      aria-busy={markPendingId === t.id}
                      onClick={() => markIds([t.id])}
                    >
                      {done ? (
                        "Completed"
                      ) : (
                        <ButtonWithSpinner
                          busy={markPendingId === t.id}
                          busyLabel="Marking…"
                          idleLabel="Mark complete"
                        />
                      )}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {markError ? (
            <p className="field-error scan-test-list__mark-error" role="alert">
              {markError}
            </p>
          ) : null}

          {multiSelected ? (
            <div className="scan-test-batch">
              <p className="scan-test-batch__summary">
                {selectedIds.size} tests selected
              </p>
              <button
                type="button"
                className="btn btn-primary btn-block scan-test-batch__submit"
                disabled={markBusy}
                aria-busy={markBatchPending}
                onClick={submitSelected}
              >
                <ButtonWithSpinner
                  busy={markBatchPending}
                  busyLabel="Submitting…"
                  idleLabel="Submit"
                />
              </button>
            </div>
          ) : null}
        </section>
      ) : lastLoadedCount === 0 && !loading && !error ? (
        <p className="scan-test-panel__empty">
          No additional tests were returned for this barcode after hiding inactive rows.
        </p>
      ) : null}

      {barcodeScanOpen ? (
        <Suspense fallback={null}>
          <BarcodeScanModal
            open
            title="Scan barcode"
            onClose={() => setBarcodeScanOpen(false)}
            onDetected={onScanDetected}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
