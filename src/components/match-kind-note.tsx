import { Info, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";

import { InfoNote } from "@/components/info-note";

type MatchKindNoteProps = {
  kind: "friendly" | "competitive";
};

/** Whether the result of a match counts toward your level, shown under the match type. */
export function MatchKindNote({ kind }: MatchKindNoteProps) {
  const { t } = useTranslation();
  return kind === "friendly" ? (
    <InfoNote icon={Info} title={t("createMatch.friendlyTitle")}>
      {t("createMatch.friendlyText")}
    </InfoNote>
  ) : (
    <InfoNote icon={Trophy} title={t("createMatch.competitiveTitle")}>
      {t("createMatch.competitiveText")}
    </InfoNote>
  );
}
