import { useCallback, useState } from "react";
import AtmIdModal from "./components/AtmIdModal.jsx";
import LabourRegistrationForm from "./components/LabourRegistrationForm.jsx";
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
        <SiteHeader atmId={atmId} onChangeAtmClick={() => setAtmModalOpen(true)} />
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
