import { useOutletContext } from "react-router-dom";
import LabourRegistrationForm from "../components/LabourRegistrationForm.jsx";

export default function RegistrationPage() {
  const { atmId } = useOutletContext();
  return <LabourRegistrationForm atmId={atmId} />;
}
