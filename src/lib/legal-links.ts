// The two legal documents live on the landing page (padelna-landing-page). The trailing slash is
// part of the address: the pages are static files, /terms/ and /privacy/.
const SITE_URL = "https://padelna.tn";

export const LEGAL_URLS = {
  terms: `${SITE_URL}/terms/`,
  privacy: `${SITE_URL}/privacy/`,
} as const;

export type LegalDocument = keyof typeof LEGAL_URLS;
