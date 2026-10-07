import { ageInYears } from "@/lib/format";

/**
 * Who the app is open to.
 *
 * The database links an app account only to the record of someone 18 or older:
 * it refuses the invite for a younger patient, and refuses the link in the app
 * even when CPF and birth date match. The record itself exists at any age — the
 * clinic treats minors — so the form accepts it and only the app side closes.
 *
 * The rule is provisional until the clinic confirms it. The database holds the
 * real barrier; this copy exists so the panel says so before the refusal.
 */
export const APP_MINIMUM_AGE = 18;

/** True when the birth date puts the patient below the app's minimum age. */
export function isBelowAppMinimumAge(birthDate: string | null | undefined): boolean {
  const age = ageInYears(birthDate);
  return age !== null && age < APP_MINIMUM_AGE;
}

/** Why there is no invite for a minor, written for whoever is at the front desk. */
export const UNDERAGE_INVITE_REASON =
  "O aplicativo só é liberado a partir dos 18 anos. A ficha de menor fica no painel, sem convite.";

/** The same reason, short enough for a menu item. */
export const UNDERAGE_INVITE_SHORT_REASON = "Menor de 18 anos";
