import { MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

/**
 * From the patient's record to the patient's conversation.
 *
 * The chat opens on the newest conversation of that patient; when there is none
 * it says so, instead of landing on someone else's.
 */
export function PatientChatShortcut({ href }: { href: string }) {
  return (
    <Button asChild variant="outline">
      <Link to={href}>
        <MessageSquare />
        Chat do paciente
      </Link>
    </Button>
  );
}

export default PatientChatShortcut;
