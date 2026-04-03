import { useCallback, useState } from "react";
import AtmIdModal from "./components/AtmIdModal.jsx";
import logoUrl from "./assets/logo.png";
import LabourRegistrationForm from "./components/LabourRegistrationForm.jsx";
import { ATM_ID_STORAGE_KEY, normalizeAtmId } from "./constants/storage.js";

/** Full brand mark in header (high-res from your icon set) */
const HEADER_LOGO_SRC = logoUrl;

function readStoredAtmId() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeAtmId(localStorage.getItem(ATM_ID_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

export default function App() {
  const [atmId, setAtmId] = useState(readStoredAtmId);
  const [atmModalOpen, setAtmModalOpen] = useState(() => !readStoredAtmId());

  const handleAtmSave = useCallback((id) => {
    const normalized = normalizeAtmId(id);
    try {
      localStorage.setItem(ATM_ID_STORAGE_KEY, normalized);
    } catch {
      /* storage full / private mode */
    }
    setAtmId(normalized);
    setAtmModalOpen(false);
  }, []);

  const blockingAtmModal = atmModalOpen && !atmId;

  return (
    <>
      <div className="app-shell" inert={blockingAtmModal ? true : undefined}>
        <header className="site-header">
          <div className="site-header__inner">
            <div className="site-header__left">
              <div className="site-header__brand-block">
                <img
                  src={HEADER_LOGO_SRC}
                  alt=""
                  // className="site-header__logo site-header__logo--full"
                  width={150}
                  // height={192}
                  // decoding="async"
                />
                {/* <div className="site-header__titles">
                  <span className="site-header__brand">YoloHealth</span>
                  <span className="site-header__tag">Labour registration</span>
                </div> */}
              </div>
            </div>
            {atmId ? (
              <div className="site-header__actions">
                <span className="atm-id-display" title="Current ATM ID">
                  ATM ID: <strong>{atmId}</strong>
                </span>
                <button
                  type="button"
                  className="btn btn-atm-change"
                  onClick={() => setAtmModalOpen(true)}
                >
                  Change ATM ID
                </button>
              </div>
            ) : null}
          </div>
        </header>
        <main className="site-main">
          <LabourRegistrationForm atmId={atmId} />
        </main>
      </div>
      <AtmIdModal
        open={atmModalOpen}
        blocking={blockingAtmModal}
        initialAtmId={atmId}
        onSave={handleAtmSave}
        onClose={() => setAtmModalOpen(false)}
      />
    </>
  );
}
