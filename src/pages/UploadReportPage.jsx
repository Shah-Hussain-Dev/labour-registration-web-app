import { useOutletContext } from "react-router-dom";
import UploadReportPanel from "../components/UploadReportPanel.jsx";

export default function UploadReportPage() {
  const { atmId } = useOutletContext();
  return <UploadReportPanel atmId={atmId} />;
}
