import { useFormContext } from "react-hook-form";

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

/**
 * The corporate e-mail field of the access forms. Reads the form from context,
 * so it goes inside `<Form {...form}>` of any form with an `email` field.
 *
 * `autoComplete="username"` is what lets the password manager pair this field
 * with the password, on login and on recovery alike.
 */
export function CorporateEmailField() {
  const { control } = useFormContext<{ email: string }>();

  return (
    <FormField
      control={control}
      name="email"
      render={({ field }) => (
        <FormItem>
          <FormLabel>E-mail corporativo</FormLabel>
          <FormControl>
            <Input
              {...field}
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="nome.sobrenome@cosc.com.br"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
