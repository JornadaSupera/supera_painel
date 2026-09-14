import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * The error banner at the top of the access screens. Renders nothing without a
 * message, so a screen can pass its error state straight in.
 */
export function AuthErrorAlert({ message }: { message: ReactNode }) {
  if (!message) return null;

  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}
