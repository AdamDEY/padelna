import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { router } from "expo-router";
import { BottomSheet, cn, useToast } from "heroui-native";
import { Clock, Minus, Plus } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
// Gesture Handler's Pressable: React Native's doesn't get taps inside the sheet
import { Pressable as GesturePressable } from "react-native-gesture-handler";

import { CourtFields } from "@/components/court-fields";
import { Dropdown, type DropdownOption as Option } from "@/components/dropdown";
import { Icon } from "@/components/icon";
import { LoadingButton } from "@/components/loading-button";
import { InfoNote } from "@/components/info-note";
import { LevelRangeSlider, MAX_LEVEL, MIN_LEVEL } from "@/components/level-range-slider";
import { MatchAudienceField } from "@/components/match-audience-field";
import { MatchKindNote } from "@/components/match-kind-note";
import { MatchTimeFields } from "@/components/match-time-fields";
import { SheetField } from "@/components/sheet-field";
import { myLevel as placeholderLevel } from "@/data/mock";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useBookableClubs } from "@/hooks/useClubs";
import { useCreateMatch } from "@/hooks/useMatches";
import { celebrate } from "@/lib/celebrate";
import { askForPushNotifications } from "@/hooks/usePushNotifications";
import { daysUntil, formatMatchDay } from "@/lib/format-date";
import { errorMessage } from "@/lib/error-message";
import { clockTime, DAYS_AHEAD } from "@/lib/match-time";
import type { MatchAudience } from "@/types/match";

// Room the pinned Publish button takes, so the last field can scroll above it
const FOOTER_SPACE = 104;
// design.md: the pinned primary button sits 34 px from the bottom edge.
// Not the safe-area inset: on a tab screen that includes the tab bar's height.
const BOTTOM_ACTION_GAP = 34;

type MatchKind = "friendly" | "competitive";

/** Today at 18:00, or the next half hour if that's already past (tomorrow 18:00 after 23:00) */
function defaultStart() {
  const date = new Date();
  date.setHours(18, 0, 0, 0);
  if (date.getTime() < Date.now()) {
    date.setTime(Date.now());
    date.setMinutes(date.getMinutes() < 30 ? 30 : 60, 0, 0);
    if (date.getHours() >= 23 && date.getMinutes() > 0) {
      date.setDate(date.getDate() + 1);
      date.setHours(18, 0, 0, 0);
    }
  }
  return date;
}

/** The default start, moved to `day` at 18:00 when that isn't today */
function startOn(day?: Date) {
  const start = defaultStart();
  if (!day || daysUntil(day, start) === 0) return start;
  const next = new Date(day);
  next.setHours(18, 0, 0, 0);
  return next;
}

/** Half a level either side of the host, as a starting point */
function defaultLevelRange(level: number): [number, number] {
  return [Math.max(MIN_LEVEL, level - 0.5), Math.min(MAX_LEVEL, level + 0.5)];
}

type CreateMatchSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Club to preselect (e.g. from a club page); the host can still change it */
  initialClubName?: string;
  /** Day to preselect (e.g. the day open on Matches); the host can still change it */
  initialDate?: Date;
};

/**
 * "Create a match" bottom sheet (design: Create match (sheet)). With a booked
 * court you pick the club and court; without one, a note says to add them once
 * booked. The match type explains whether the result counts toward your level.
 */
export function CreateMatchSheet({
  isOpen,
  onOpenChange,
  initialClubName,
  initialDate,
}: CreateMatchSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const clubs = useBookableClubs();
  const { data: profile } = useMyProfile();
  const createMatch = useCreateMatch();
  const myLevel = profile?.level ?? placeholderLevel;
  const [now] = useState(() => new Date());
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD);

  const [isBooked, setIsBooked] = useState(true);
  // Until the host picks one, the club follows `initialClubName` (clubs may load after the sheet)
  const [pickedClub, setClub] = useState<Option | undefined>();
  const initialClub = clubs.find((item) => item.name === initialClubName);
  const club =
    pickedClub ?? (initialClub ? { value: initialClub.id, label: initialClub.name } : undefined);
  const [court, setCourt] = useState<Option | undefined>();
  // Until the host picks a day or time, the start follows `initialDate`
  const [pickedStart, setStartsAt] = useState<Date>();
  const startsAt = pickedStart ?? startOn(initialDate);
  // Until the host moves the slider, the range follows their level (which may load after the sheet)
  const [pickedRange, setLevelRange] = useState<[number, number]>();
  const levelRange = pickedRange ?? defaultLevelRange(myLevel);
  const [kind, setKind] = useState<MatchKind>("friendly");
  const kindOptions: Option[] = [
    { value: "friendly", label: t("match.kind.friendly") },
    { value: "competitive", label: t("match.kind.competitive") },
  ];
  const [audience, setAudience] = useState<MatchAudience>("mixed");
  const [playersNeeded, setPlayersNeeded] = useState(2);

  // `now` is when Home opened; publish() checks the real clock again
  const isInPast = startsAt.getTime() <= now.getTime();
  // A booked court needs the club and court; otherwise those come later
  const canPublish =
    (!isBooked || (club !== undefined && court !== undefined)) && !isInPast && !createMatch.isPending;

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Start the next match from a clean form
      setIsBooked(true);
      setClub(undefined);
      setCourt(undefined);
      setStartsAt(undefined);
      setLevelRange(undefined);
      setKind("friendly");
      setAudience("mixed");
      setPlayersNeeded(2);
    }
    onOpenChange(open);
  }

  function dayLabel(date: Date) {
    const days = daysUntil(date);
    if (days === 0) return t("time.today");
    if (days === 1) return t("time.tomorrow");
    return formatMatchDay(date);
  }

  function publish() {
    if (startsAt.getTime() <= Date.now()) {
      toast.show({ variant: "danger", label: t("createMatch.timePassed"), description: t("createMatch.pickLater") });
      return;
    }
    const when = `${dayLabel(startsAt)} · ${clockTime(startsAt)}`;
    createMatch.mutate(
      {
        courtId: isBooked ? court?.value : undefined,
        startsAt,
        levelMin: levelRange[0],
        levelMax: levelRange[1],
        kind,
        audience,
        playersNeeded,
      },
      {
        onSuccess: (matchId) => {
          toast.show({
            variant: "success",
            label: t("createMatch.published"),
            description:
              isBooked && club
                ? t("createMatch.publishedBooked", { when, club: club.label, court: court?.label })
                : t("createMatch.publishedNotBooked", { when }),
          });
          handleOpenChange(false);
          router.push({ pathname: "/match/[id]", params: { id: matchId } });
          celebrate();
          // The first moment pushes matter: hearing when players join
          void askForPushNotifications();
        },
        onError: (error) =>
          toast.show({
            variant: "danger",
            label: t("createMatch.publishFailed"),
            description: errorMessage(error),
          }),
      },
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      {/* A plain view instead of iOS's full-window overlay, so the native date and
          time pickers (SwiftUI) can render inside the sheet */}
      <BottomSheet.Portal disableFullWindowOverlay>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["94%"]}
          enableDynamicSizing={false}
          enableOverDrag={false}
          contentContainerClassName="h-full p-0"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
          footerComponent={(props: BottomSheetFooterProps) => (
            <BottomSheetFooter {...props}>
              <View className="bg-overlay px-5 pt-3" style={{ paddingBottom: BOTTOM_ACTION_GAP }}>
                <LoadingButton
                  size="lg"
                  isDisabled={!canPublish && !createMatch.isPending}
                  isLoading={createMatch.isPending}
                  onPress={publish}
                >
                  {t("createMatch.publish")}
                </LoadingButton>
              </View>
            </BottomSheetFooter>
          )}
        >
          <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
            <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
              {t("createMatch.title")}
            </BottomSheet.Title>
            <BottomSheet.Close className="size-10 rounded-full bg-fill" />
          </View>

          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: FOOTER_SPACE, gap: 14 }}
          >
            <CourtFields
              clubs={clubs}
              isBooked={isBooked}
              onBookedChange={setIsBooked}
              club={club}
              onClubChange={setClub}
              court={court}
              onCourtChange={setCourt}
            />
            {isBooked ? null : (
              <InfoNote icon={Clock} tone="warning" title={t("createMatch.bookFirstTitle")}>
                {t("createMatch.bookFirstText")}
              </InfoNote>
            )}

            <MatchTimeFields
              startsAt={startsAt}
              onChange={setStartsAt}
              minimumDate={now}
              maximumDate={lastDay}
              isInPast={isInPast}
            />

            <LevelRangeSlider value={levelRange} onChange={setLevelRange} myLevel={myLevel} />

            <View className="flex-row gap-2.5">
              <SheetField label={t("createMatch.matchType")} className="flex-1">
                <Dropdown
                  label={t("createMatch.matchType")}
                  placeholder={t("match.kind.friendly")}
                  options={kindOptions}
                  value={kindOptions.find((option) => option.value === kind)}
                  onChange={(option) => option && setKind(option.value as MatchKind)}
                />
              </SheetField>
              <SheetField label={t("createMatch.playersNeeded")} className="flex-1">
                <View className="h-[52px] flex-row items-center justify-between rounded-[14px] border border-line-input bg-surface px-1.5">
                  <StepButton
                    icon={Minus}
                    label={t("createMatch.fewerPlayers")}
                    disabled={playersNeeded <= 1}
                    onPress={() => setPlayersNeeded((n) => Math.max(1, n - 1))}
                  />
                  <Text
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={t("createMatch.playersNeededCount", { count: playersNeeded })}
                    className="font-black text-[18px] text-foreground"
                  >
                    {playersNeeded}
                  </Text>
                  <StepButton
                    icon={Plus}
                    label={t("createMatch.morePlayers")}
                    disabled={playersNeeded >= 3}
                    onPress={() => setPlayersNeeded((n) => Math.min(3, n + 1))}
                  />
                </View>
              </SheetField>
            </View>

            <MatchAudienceField value={audience} onChange={setAudience} gender={profile?.gender} />

            <MatchKindNote kind={kind} />
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function StepButton({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: typeof Plus;
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <View className={cn("size-10", disabled && "opacity-40")}>
      <GesturePressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={{ flex: 1 }}
      >
        <View className="flex-1 items-center justify-center rounded-[10px] bg-fill">
          <Icon as={icon} size={20} />
        </View>
      </GesturePressable>
    </View>
  );
}
