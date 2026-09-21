import { LegalDocumentView } from "../components/LegalDocumentView";
import { TERMS_OF_USE } from "../content/terms-of-use";

export default function TermsOfUsePage() {
  return <LegalDocumentView document={TERMS_OF_USE} />;
}
