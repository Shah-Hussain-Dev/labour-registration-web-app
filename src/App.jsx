import { useCallback, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AtmIdModal from "./components/AtmIdModal.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import RegistrationPage from "./pages/RegistrationPage.jsx";
import ScanTestPage from "./pages/ScanTestPage.jsx";
import UploadReportPage from "./pages/UploadReportPage.jsx";
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
      <Routes>
        <Route
          element={
            <AppLayout
              atmId={atmId}
              onAtmOpen={() => setAtmModalOpen(true)}
              blockingAtmModal={blockingAtmModal}
            />
          }
        >
          <Route index element={<RegistrationPage />} />
          <Route path="scan-tests" element={<ScanTestPage />} />
          <Route path="upload-report" element={<UploadReportPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
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
