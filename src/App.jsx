import { useCallback, useState } from "react";
import AtmIdModal from "./components/AtmIdModal.jsx";
import LabourRegistrationForm from "./components/LabourRegistrationForm.jsx";
import ScanTestPanel from "./components/ScanTestPanel.jsx";
import SiteHeader from "./components/SiteHeader.jsx";
import { ATM_ID_STORAGE_KEY, normalizeAtmId } from "./constants/storage.js";

function readStoredAtmId() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeAtmId(localStorage.getItem(ATM_ID_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

const TABS = {
  registration: "registration",
  scan: "scan",
};

function BottomTabIcon({ children }) {
  return (
    <svg
      className="bottom-tab-bar__icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

export default function App() {
  const [atmId, setAtmId] = useState(readStoredAtmId);
  const [atmModalOpen, setAtmModalOpen] = useState(() => !readStoredAtmId());
  const [activeTab, setActiveTab] = useState(TABS.registration);

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
        <SiteHeader />
        <main
          className="site-main site-main--bottom-tabs"
          id="main-tab-panel"
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === TABS.registration ? (
            <LabourRegistrationForm atmId={atmId} />
          ) : (
            <ScanTestPanel />
          )}
        </main>
        <nav className="bottom-tab-bar" aria-label="Primary">
          <div className="bottom-tab-bar__inner">
            <div className="bottom-tab-bar__tablist" role="tablist" aria-label="Sections">
              <button
                type="button"
                id="tab-registration"
                role="tab"
                aria-selected={activeTab === TABS.registration}
                aria-controls="main-tab-panel"
                className={`bottom-tab-bar__tab${activeTab === TABS.registration ? " bottom-tab-bar__tab--active" : ""}`}
                onClick={() => setActiveTab(TABS.registration)}
              >
                <BottomTabIcon>
                  <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="8.5" cy="7" r="4" />
                  <line x1="20" y1="8" x2="20" y2="14" />
                  <line x1="23" y1="11" x2="17" y2="11" />
                </BottomTabIcon>
                <span className="bottom-tab-bar__label">Registration</span>
              </button>
              <button
                type="button"
                id="tab-scan"
                role="tab"
                aria-selected={activeTab === TABS.scan}
                aria-controls="main-tab-panel"
                className={`bottom-tab-bar__tab${activeTab === TABS.scan ? " bottom-tab-bar__tab--active" : ""}`}
                onClick={() => setActiveTab(TABS.scan)}
              >
                <BottomTabIcon>
                  <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                  <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                  <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                  <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                  <line x1="7" y1="12" x2="17" y2="12" />
                </BottomTabIcon>
                <span className="bottom-tab-bar__label">Scan and Test</span>
              </button>
            </div>
            <button
              type="button"
              className="bottom-tab-bar__atm"
              onClick={() => setAtmModalOpen(true)}
              aria-haspopup="dialog"
              aria-label={atmId ? `Update ATM ID ${atmId}` : "Add ATM ID"}
            >
              <span className="bottom-tab-bar__atm-main">
                <BottomTabIcon>
                  <rect x="4" y="2" width="16" height="20" rx="2" fill="none" />
                  <rect x="7" y="5" width="10" height="6" rx="1" fill="none" />
                  <line x1="8" y1="15" x2="16" y2="15" />
                  <line x1="9" y1="18" x2="15" y2="18" />
                </BottomTabIcon>
                {atmId ? (
                  <span className="bottom-tab-bar__atm-id" title={atmId}>
                    {atmId}
                  </span>
                ) : null}
              </span>
              <span className="bottom-tab-bar__label">{atmId ? "Update ATM" : "Add ATM"}</span>
            </button>
          </div>
        </nav>
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
