import { openBrowserAsync } from "expo-web-browser";
import { useToast } from "heroui-native";
import { useTranslation } from "react-i18next";

import { LEGAL_URLS, type LegalDocument } from "@/lib/legal-links";

/** Opens the Terms of Use or the Privacy Policy in the in-app browser; a toast says if it can't. */
export function useOpenLegal() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return function openLegal(document: LegalDocument) {
    openBrowserAsync(LEGAL_URLS[document]).catch(() => {
      toast.show({
        variant: "danger",
        label: t("auth.legalFailed", { name: document === "terms" ? t("auth.terms") : t("auth.privacy") }),
        description: t("auth.legalFailedText"),
      });
    });
  };
}
