import { lazy, Suspense, useCallback, useState, useEffect } from "react";
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
  /** Single-card mark API in flight (row id). */
  const [markPendingId, setMarkPendingId] = useState(null);

  const markBusy = markPendingId != null;

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

  // Background polling to monitor report_url
  useEffect(() => {
    if (!barcode || tests.length === 0) return;

    // Check if there is any pending test (not done and no report_url)
    const hasPendingReport = tests.some((t) => !t.is_test_done && !t.report_url);
    if (!hasPendingReport) return;

    let active = true;
    let timerId = null;

    const poll = async () => {
      try {
        const list = await fetchAdditionalTests(barcode);
        if (!active) return;
        const rows = list.filter(isValidTestRow).filter(isListedTestRow);
        rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

        // Check if anything actually changed before setting state to avoid unnecessary renders
        const isSame = rows.length === tests.length && rows.every((row, i) => {
          const prev = tests[i];
          return prev &&
            prev.id === row.id &&
            prev.is_test_done === row.is_test_done &&
            prev.report_url === row.report_url &&
            prev.status === row.status;
        });

        if (!isSame) {
          setTests(rows);
        }
      } catch (err) {
        console.warn("Background poll failed:", err);
      }

      // Schedule next poll if still active and still has pending reports
      if (active) {
        timerId = setTimeout(poll, 2000); // Poll every 2 seconds
      }
    };

    // Schedule the first poll
    timerId = setTimeout(poll, 2000);

    return () => {
      active = false;
      if (timerId) clearTimeout(timerId);
    };
  }, [barcode, tests]);

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
    setMarkPendingId(ids[0] ?? null);
    try {
      await markAdditionalTestsDone(ids);
      // Immediately refetch list to show updated status/report_url from the API
      if (barcode) {
        const list = await fetchAdditionalTests(barcode);
        const rows = list.filter(isValidTestRow).filter(isListedTestRow);
        rows.sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
        setTests(rows);
      }
    } catch (e) {
      setMarkError(e?.message || "Could not mark tests complete.");
    } finally {
      setMarkPendingId(null);
    }
  }, [barcode]);

  const hasRows = tests.length > 0;

  return (
    <div className="scan-test-panel">
      <div className="form-card scan-test-panel__card">
        <h1 className="form-card__title scan-test-panel__title">Scan and Test</h1>
      

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
            aria-describedby={error && !loading ? "scan-test-load-error" : undefined}
            placeholder="e.g. 1234567890"
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
      </div>

      {error ? (
        <p id="scan-test-load-error" className="field-error scan-test-panel__error scan-test-panel__error--load" role="alert">
          {error}
        </p>
      ) : null}

      {hasRows ? (
        <section className="scan-test-list" aria-label="Additional tests">
          <h2 className="scan-test-list__heading">Additional Tests</h2>

          <ul className="scan-test-list__grid">
            {tests.map((t) => {
              const done = Boolean(t.is_test_done);
              const sc = statusChipClass(t.status);
              const hasReportUrl = typeof t.report_url === "string" && t.report_url.trim().length > 0;
              const canSubmit = !done && hasReportUrl;
              return (
                <li key={t.id} className={`scan-test-card${done ? " scan-test-card--done" : ""}`}>
                  <div className="scan-test-card__head">
                    <div className="scan-test-card__head-main">
                      <span className="scan-test-card__name">{t.medical_service_name}</span>
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
                    {hasReportUrl && (
                      <div className="scan-test-card__row">
                        <dt>Report</dt>
                        <dd>
                          <a
                            href={t.report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--yh-primary)", textDecoration: "underline", fontWeight: "600" }}
                          >
                            View Report URL
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                  <div className="scan-test-card__foot">
                    <button
                      type="button"
                      className="btn btn-primary btn-block scan-test-card__complete"
                      disabled={!canSubmit || markBusy}
                      aria-busy={markPendingId === t.id}
                      onClick={() => markIds([t.id])}
                    >
                      {done ? (
                        "Completed"
                      ) : (
                        <ButtonWithSpinner
                          busy={markPendingId === t.id}
                          busyLabel="Submitting…"
                          idleLabel="Mark as Completed"
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
