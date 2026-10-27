// Tunisian mobile numbers: 8 digits, optionally with +216 / 00216 in front
const TN_PHONE = /^(?:\+216|00216)?\s?\d{2}\s?\d{3}\s?\d{3}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MIN_PASSWORD_LENGTH = 8;

export function isEmail(value: string) {
  return EMAIL.test(value.trim());
}

export function isEmailOrPhone(value: string) {
  return isEmail(value) || TN_PHONE.test(value.trim());
}
