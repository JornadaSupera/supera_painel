import { useState, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { brDateToIso, brTimeToIso, isoToBrDate, maskDate, maskTime } from "@/lib/dateMask";

/**
 * Date and time fields in the Brazilian format: dd/mm/aaaa and 24 hours.
 *
 * The value that goes in and out is the ISO one (`YYYY-MM-DD`, `HH:mm`), so a
 * form swaps `<Input type="date">` for `<DateInput>` and nothing else changes.
 * While the text is incomplete or not a real moment, the value is `""` — the
 * form's own validation says what is missing — and the half-typed text stays on
 * screen.
 */

type FieldProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange" | "defaultValue"> & {
  value: string;
  onChange: (value: string) => void;
};

interface MaskedFieldConfig {
  mask: (raw: string) => string;
  toText: (value: string) => string;
  toValue: (text: string) => string;
  placeholder: string;
  maxLength: number;
}

function MaskedField({
  value,
  onChange,
  config,
  ...props
}: FieldProps & { config: MaskedFieldConfig }) {
  const [text, setText] = useState(() => config.toText(value));

  // The value changed from outside (a form reset, a default arriving late):
  // show it. When it only echoes what was typed, leave the text alone — that is
  // what keeps a half-typed date from being wiped on every keystroke.
  if (value !== config.toValue(text)) {
    const external = config.toText(value);
    if (external !== text) setText(external);
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={config.placeholder}
      maxLength={config.maxLength}
      value={text}
      onChange={(event) => {
        const masked = config.mask(event.target.value);
        setText(masked);
        onChange(config.toValue(masked));
      }}
    />
  );
}

const DATE_CONFIG: MaskedFieldConfig = {
  mask: maskDate,
  toText: isoToBrDate,
  toValue: brDateToIso,
  placeholder: "dd/mm/aaaa",
  maxLength: 10,
};

const TIME_CONFIG: MaskedFieldConfig = {
  mask: maskTime,
  toText: (value) => value.slice(0, 5),
  toValue: brTimeToIso,
  placeholder: "hh:mm",
  maxLength: 5,
};

export function DateInput(props: FieldProps) {
  return <MaskedField {...props} config={DATE_CONFIG} />;
}

export function TimeInput(props: FieldProps) {
  return <MaskedField {...props} config={TIME_CONFIG} />;
}
