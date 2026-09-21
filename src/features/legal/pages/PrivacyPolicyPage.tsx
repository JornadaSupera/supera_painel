import { LegalDocumentView } from "../components/LegalDocumentView";
import { PRIVACY_POLICY } from "../content/privacy-policy";

export default function PrivacyPolicyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
