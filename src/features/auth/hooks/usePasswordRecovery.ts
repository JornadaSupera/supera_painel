import { useMutation } from "@tanstack/react-query";

import { authApi, call } from "@/services/apiClient";
import type { PasswordRecoveryInput } from "@/services/contracts/operations";

/**
 * Changes the password of an app account from its recovery link.
 *
 * No audit entry and no toast: the person is not a panel user, and the screen
 * itself is the feedback. The token never goes into a log.
 */
export function usePasswordRecovery() {
  return useMutation({
    mutationFn: async (input: PasswordRecoveryInput) => {
      const { data } = await call(() => authApi.completePasswordRecovery(input));
      return data;
    },
  });
}
