import type { Messages } from "@/i18n/locales/en";

// Makes t("…") check its key against the English strings
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: Messages };
  }
}
