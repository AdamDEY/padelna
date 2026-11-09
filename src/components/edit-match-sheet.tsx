import { BottomSheet, Button, useToast } from "heroui-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { LevelRangeSlider } from "@/components/level-range-slider";
import { MatchAudienceField } from "@/components/match-audience-field";
import { MatchKindNote } from "@/components/match-kind-note";
import { MatchTimeFields } from "@/components/match-time-fields";
import { SheetField } from "@/components/sheet-field";
import { myLevel as placeholderLevel } from "@/data/mock";
import { useUpdateMatch } from "@/hooks/useMatches";
import { useMyProfile } from "@/hooks/useMyProfile";
import { errorMessage } from "@/lib/error-message";
import { DAYS_AHEAD } from "@/lib/match-time";
import type { MatchAudience, MatchDetails } from "@/types/match";

type MatchKind = MatchDetails["kind"];

type EditMatchSheetProps = {
  match: MatchDetails;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Edit time, level or type" from the host tools: the same date, time, level and type fields as
 * Create match (sheet). Only offered while nobody else has joined; the database checks it too.
 */
export function EditMatchSheet({ match, isOpen, onOpenChange }: EditMatchSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: profile } = useMyProfile();
  const updateMatch = useUpdateMatch();
  const myLevel = profile?.level ?? placeholderLevel;
  const [now, setNow] = useState(() => new Date());
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD);

  // Until the host changes a field, it shows the match as it is
  const [pickedStart, setStartsAt] = useState<Date>();
  const [pickedRange, setLevelRange] = useState<[number, number]>();
  const [pickedKind, setKind] = useState<MatchKind>();
  const [pickedAudience, setAudience] = useState<MatchAudience>();
  const startsAt = pickedStart ?? match.startsAt;
  const levelRange = pickedRange ?? [match.levelMin ?? 1, match.levelMax ?? 7];
  const kind = pickedKind ?? match.kind;
  const audience = pickedAudience ?? match.audience ?? "mixed";
  const kindOptions: DropdownOption[] = [
    { value: "friendly", label: t("match.kind.friendly") },
    { value: "competitive", label: t("match.kind.competitive") },
  ];

  const hasChanges =
    startsAt.getTime() !== match.startsAt.getTime() ||
    levelRange[0] !== match.levelMin ||
    levelRange[1] !== match.levelMax ||
    kind !== match.kind ||
    audience !== (match.audience ?? "mixed");
  const isInPast = startsAt.getTime() <= now.getTime();

  function handleOpenChange(open: boolean) {
    if (open) {
      setNow(new Date());
    } else {
      setStartsAt(undefined);
      setLevelRange(undefined);
      setKind(undefined);
      setAudience(undefined);
    }
    onOpenChange(open);
  }

  function save() {
    if (startsAt.getTime() <= Date.now()) {
      toast.show({ variant: "danger", label: t("createMatch.timePassed"), description: t("createMatch.pickLater") });
      return;
    }
    updateMatch.mutate(
      {
        matchId: match.id,
        changes: { startsAt, levelMin: levelRange[0], levelMax: levelRange[1], kind, audience },
      },
      {
        onSuccess: () => {
          toast.show({ variant: "success", label: t("editMatch.saved") });
          handleOpenChange(false);
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: t("editMatch.saveFailed"), description: errorMessage(error) }),
      },
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      {/* A plain view instead of iOS's full-window overlay, so the native date picker renders */}
      <BottomSheet.Portal disableFullWindowOverlay>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-3.5 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between gap-3">
              <BottomSheet.Title className="flex-1 font-black text-[24px] tracking-[-0.4px] text-foreground">
                {t("editMatch.title")}
              </BottomSheet.Title>
              <BottomSheet.Close className="size-10 rounded-full bg-fill" />
            </View>
            <BottomSheet.Description className="font-normal text-[15px] leading-[22px] text-ink-2">
              {t("editMatch.text")}
            </BottomSheet.Description>
          </View>

          <MatchTimeFields
            startsAt={startsAt}
            onChange={setStartsAt}
            minimumDate={now}
            maximumDate={lastDay}
            isInPast={isInPast}
          />

          <LevelRangeSlider value={levelRange} onChange={setLevelRange} myLevel={myLevel} />

          <SheetField label={t("createMatch.matchType")}>
            <Dropdown
              label={t("createMatch.matchType")}
              placeholder={t("match.kind.friendly")}
              options={kindOptions}
              value={kindOptions.find((option) => option.value === kind)}
              onChange={(option) => option && setKind(option.value as MatchKind)}
            />
          </SheetField>
          <MatchAudienceField value={audience} onChange={setAudience} gender={profile?.gender} />
          <MatchKindNote kind={kind} />

          <Button
            size="lg"
            isDisabled={!hasChanges || isInPast || updateMatch.isPending}
            onPress={save}
            className="mt-1"
          >
            {t("editMatch.save")}
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
