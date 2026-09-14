import { FormControl } from "@/components/ui/form";
import { Select, SelectContent, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Option } from "@/lib/enums";
import { cn } from "@/lib/utils";
import { OptionItems } from "./select-options";
import { fromSelectValue, toSelectValue } from "./select-value";

/**
 * A full-width select for a react-hook-form field. Goes inside `<FormItem>`,
 * between the label and the message, so the field's id and aria wiring reach
 * the trigger.
 *
 *   <FormField name="risco" render={({ field }) => (
 *     <FormItem>
 *       <FormLabel>Risco</FormLabel>
 *       <FormSelect value={field.value} onValueChange={field.onChange} options={...} />
 *       <FormMessage />
 *     </FormItem>
 *   )} />
 */

export interface FormSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /**
   * Adds a first item that stands for "no value" and maps it to an empty
   * string — for optional fields.
   */
  emptyLabel?: string;
  /** Applied to the trigger and to the list, e.g. `capitalize` for lowercase labels. */
  className?: string;
}

export function FormSelect({
  value,
  onValueChange,
  options,
  placeholder,
  emptyLabel,
  className,
}: FormSelectProps) {
  const optional = emptyLabel !== undefined;

  return (
    <Select
      value={optional ? toSelectValue(value) : value}
      onValueChange={(next) => onValueChange(optional ? fromSelectValue(next) : next)}
    >
      <FormControl>
        <SelectTrigger className={cn("w-full", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </FormControl>

      <SelectContent className={className}>
        <OptionItems options={options} emptyLabel={emptyLabel} />
      </SelectContent>
    </Select>
  );
}
