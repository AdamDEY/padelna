// Tunisian mobile numbers: 8 digits, optionally with +216 / 00216 in front
const TN_PHONE = /^(?:\+216|00216)?\s?\d{2}\s?\d{3}\s?\d{3}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// The 8 digits after +216, with optional spaces: "20 123 456"
const TN_LOCAL_PHONE = /^\d{2}\s?\d{3}\s?\d{3}$/;
export const MIN_PASSWORD_LENGTH = 8;

export function isEmail(value: string) {
  return EMAIL.test(value.trim());
}

export function isEmailOrPhone(value: string) {
  return isEmail(value) || TN_PHONE.test(value.trim());
}

/** A Tunisian number typed after a fixed +216 prefix */
export function isLocalPhone(value: string) {
  return TN_LOCAL_PHONE.test(value.trim());
}
