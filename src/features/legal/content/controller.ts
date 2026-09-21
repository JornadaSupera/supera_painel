/**
 * Who answers for the data — shared by both documents.
 *
 * The clinic is the controller under the LGPD: it decides why and how patient
 * data is processed. The company that builds and supports the platform is an
 * operator acting on the clinic's documented instructions, and is described by
 * role, not by name.
 */
export const CONTROLLER = {
  name: "Centro de Oncologia de Santa Catarina Ltda.",
  shortName: "Centro de Oncologia de Santa Catarina",
  taxId: "34.701.199/0001-05",
  address: "Rua São Marcos, 1259, 2º andar, Santa Maria, Chapecó/SC",
  phone: "(49) 3323-9836",
  phoneHref: "tel:+554933239836",
  city: "Chapecó/SC",
} as const;

/**
 * Data protection officer (encarregado, LGPD art. 41).
 *
 * The clinic has not appointed one publicly yet. While these stay `null` the
 * pages point to the clinic's switchboard and the in-app request instead — the
 * contact never renders as a placeholder.
 */
export const DATA_PROTECTION_OFFICER: { name: string | null; email: string | null } = {
  name: null,
  email: null,
};

/** Where the patient exercises LGPD rights without leaving the app. */
export const IN_APP_PRIVACY_PATH = "Perfil → Privacidade e dados (LGPD)";

export const EMERGENCY_NUMBER = "192";
