import { useCallback, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AtmIdModal from "./components/AtmIdModal.jsx";
import AppToaster from "./components/AppToaster.jsx";
import AppLayout from "./layout/AppLayout.jsx";
import RegistrationPage from "./pages/RegistrationPage.jsx";
import ScanTestPage from "./pages/ScanTestPage.jsx";
import UploadReportPage from "./pages/UploadReportPage.jsx";
import { ATM_ID_STORAGE_KEY, BARCODE_PREFIX_STORAGE_KEY, normalizeAtmId, normalizeBarcodePrefix } from "./constants/storage.js";

function readStoredAtmId() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeAtmId(localStorage.getItem(ATM_ID_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

function readStoredBarcodePrefix() {
  if (typeof window === "undefined") return "";
  try {
    return normalizeBarcodePrefix(localStorage.getItem(BARCODE_PREFIX_STORAGE_KEY) ?? "");
  } catch {
    return "";
  }
}

export default function App() {
  const [atmId, setAtmId] = useState(readStoredAtmId);
  const [barcodePrefix, setBarcodePrefix] = useState(readStoredBarcodePrefix);
  const [atmModalOpen, setAtmModalOpen] = useState(() => !readStoredAtmId());

  const handleAtmSave = useCallback(({ atmId: nextAtmId, barcodePrefix: nextBarcodePrefix }) => {
    const normalizedAtm = normalizeAtmId(nextAtmId);
    const normalizedPrefix = normalizeBarcodePrefix(nextBarcodePrefix);
    try {
      localStorage.setItem(ATM_ID_STORAGE_KEY, normalizedAtm);
      localStorage.setItem(BARCODE_PREFIX_STORAGE_KEY, normalizedPrefix);
    } catch {
      /* storage full / private mode */
    }
    setAtmId(normalizedAtm);
    setBarcodePrefix(normalizedPrefix);
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
              barcodePrefix={barcodePrefix}
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
        initialBarcodePrefix={barcodePrefix}
        onSave={handleAtmSave}
        onClose={() => setAtmModalOpen(false)}
      />
      <AppToaster />
    </>
  );
}
