import { useTranslation } from "react-i18next";

import { SegmentedControl } from "@/components/segmented-control";
import { SheetField } from "@/components/sheet-field";
import type { MatchAudience } from "@/types/match";

type MatchAudienceFieldProps = {
  value: MatchAudience;
  onChange: (value: MatchAudience) => void;
  /** The host's gender: a men or women match is only offered for their own */
  gender: "male" | "female" | undefined;
};

/** "Who can join" for Create match: Mixed for anyone, or the host's own gender only. */
export function MatchAudienceField({ value, onChange, gender }: MatchAudienceFieldProps) {
  const { t } = useTranslation();
  const options: { value: MatchAudience; label: string }[] = [
    { value: "mixed", label: t("match.audience.mixed") },
  ];
  if (gender) {
    const own: MatchAudience = gender === "male" ? "men" : "women";
    options.push({ value: own, label: t(`match.audience.${own}`) });
  }
  return (
    <SheetField label={t("createMatch.whoCanJoin")}>
      <SegmentedControl options={options} value={value} onChange={onChange} />
    </SheetField>
  );
}
