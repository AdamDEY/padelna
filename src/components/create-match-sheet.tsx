import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { router } from "expo-router";
import { BottomSheet, Button, cn, Slider, useToast } from "heroui-native";
import { CalendarDays, Check, Clock, Info, MapPin, Minus, Plus, Trophy } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Text, View } from "react-native";
// Gesture Handler's Pressable: React Native's doesn't get taps inside the sheet
import { Pressable as GesturePressable } from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";

import { Dropdown, type DropdownOption as Option } from "@/components/dropdown";
import { Icon } from "@/components/icon";
import { InfoNote } from "@/components/info-note";
import { SegmentedControl } from "@/components/segmented-control";
import { myLevel as placeholderLevel } from "@/data/mock";
import { useMyProfile } from "@/hooks/useMyProfile";
import { useBookableClubs } from "@/hooks/useClubs";
import { useCreateMatch } from "@/hooks/useMatches";
import { dateLocale, daysUntil, formatMatchDay } from "@/lib/format-date";

// Room the pinned Publish button takes, so the last field can scroll above it
const FOOTER_SPACE = 104;
// design.md: the pinned primary button sits 34 px from the bottom edge.
// Not the safe-area inset: on a tab screen that includes the tab bar's height.
const BOTTOM_ACTION_GAP = 34;

const MIN_LEVEL = 1;
const MAX_LEVEL = 7;
// Every padel match in Tunisia is booked for 90 minutes
const MATCH_MINUTES = 90;
const DAYS_AHEAD = 30;
// Start times every half hour, 07:00 to 23:00
const TIME_OPTIONS: Option[] = Array.from({ length: 33 }, (_, i) => {
  const minutes = 7 * 60 + i * 30;
  const label = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
  return { value: label, label };
});

type MatchKind = "friendly" | "competitive";

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

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

/** Half a level either side of the host, as a starting point */
function defaultLevelRange(level: number): [number, number] {
  return [Math.max(MIN_LEVEL, level - 0.5), Math.min(MAX_LEVEL, level + 0.5)];
}

type CreateMatchSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Club to preselect (e.g. from a club page); the host can still change it */
  initialClubName?: string;
};

/**
 * "Create a match" bottom sheet (design: Create match (sheet)). With a booked
 * court you pick the club and court; without one, a note says to add them once
 * booked. The match type explains whether the result counts toward your level.
 */
export function CreateMatchSheet({ isOpen, onOpenChange, initialClubName }: CreateMatchSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const accent = useCSSVariable("--color-accent") as string;
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
  const [startsAt, setStartsAt] = useState(defaultStart);
  // Until the host moves the slider, the range follows their level (which may load after the sheet)
  const [pickedRange, setLevelRange] = useState<[number, number]>();
  const levelRange = pickedRange ?? defaultLevelRange(myLevel);
  const [kind, setKind] = useState<MatchKind>("friendly");
  const kindOptions: Option[] = [
    { value: "friendly", label: t("match.kind.friendly") },
    { value: "competitive", label: t("match.kind.competitive") },
  ];
  const [playersNeeded, setPlayersNeeded] = useState(2);

  const selectedClub = clubs.find((item) => item.id === club?.value);
  const courtOptions: Option[] = (selectedClub?.courts ?? []).map((item) => ({
    value: item.id,
    label: String(item.number),
  }));
  const endsAt = new Date(startsAt.getTime() + MATCH_MINUTES * 60_000);
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
      setStartsAt(defaultStart());
      setLevelRange(undefined);
      setKind("friendly");
      setPlayersNeeded(2);
    }
    onOpenChange(open);
  }

  // The date picker changes the day, the time picker the hour; keep the other part
  function setDay(day: Date) {
    const next = new Date(startsAt);
    next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
    setStartsAt(next);
  }

  function setTime(time: string) {
    const [hours, minutes] = time.split(":").map(Number);
    const next = new Date(startsAt);
    next.setHours(hours, minutes, 0, 0);
    setStartsAt(next);
  }

  const timeValue = TIME_OPTIONS.find((option) => option.value === formatTime(startsAt));

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
    const when = `${dayLabel(startsAt)} · ${formatTime(startsAt)}`;
    createMatch.mutate(
      {
        courtId: isBooked ? court?.value : undefined,
        startsAt,
        levelMin: levelRange[0],
        levelMax: levelRange[1],
        kind,
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
        },
        onError: (error) =>
          toast.show({
            variant: "danger",
            label: t("createMatch.publishFailed"),
            description: error.message,
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
                <Button size="lg" isDisabled={!canPublish} onPress={publish}>
                  {t("createMatch.publish")}
                </Button>
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
            <Field label={t("createMatch.courtBooked")}>
              <SegmentedControl
                value={isBooked ? "yes" : "no"}
                onChange={(value) => setIsBooked(value === "yes")}
                options={[
                  { value: "yes", label: t("createMatch.yesBooked"), icon: Check },
                  { value: "no", label: t("createMatch.notYet") },
                ]}
              />
            </Field>

            {isBooked ? (
              <View className="flex-row gap-2.5">
                <Field label={t("createMatch.club")} className="flex-[2]">
                  <Dropdown
                    label={t("createMatch.club")}
                    icon={MapPin}
                    placeholder={t("createMatch.chooseClub")}
                    options={clubs.map((item) => ({ value: item.id, label: item.name }))}
                    value={club}
                    onChange={(option) => {
                      setClub(option);
                      setCourt(undefined);
                    }}
                  />
                </Field>
                <Field label={t("createMatch.courtNumber")} className="flex-1">
                  <Dropdown
                    label={t("createMatch.courtNumberA11y")}
                    placeholder="–"
                    options={courtOptions}
                    value={court}
                    onChange={setCourt}
                    isDisabled={!selectedClub}
                  />
                </Field>
              </View>
            ) : (
              <InfoNote icon={Clock} tone="warning" title={t("createMatch.bookFirstTitle")}>
                {t("createMatch.bookFirstText")}
              </InfoNote>
            )}

            <View className="flex-row gap-2.5">
              <Field label={t("createMatch.date")} className="flex-1">
                <DateField
                  value={startsAt}
                  minimumDate={now}
                  maximumDate={lastDay}
                  accentColor={accent}
                  onChange={setDay}
                />
              </Field>
              <Field
                label={t("createMatch.time")}
                detail={`· ${t("time.minutes", { count: MATCH_MINUTES })}`}
                className="flex-1"
              >
                <Dropdown
                  label={t("createMatch.startTime")}
                  placeholder="18:00"
                  options={TIME_OPTIONS}
                  value={timeValue}
                  onChange={(option) => option && setTime(option.value)}
                  suffix={`– ${formatTime(endsAt)}`}
                />
              </Field>
            </View>

            {isInPast ? (
              <Text accessibilityRole="alert" className="-mt-1 font-semibold text-[13px] text-danger">
                {t("createMatch.timePassed")}. {t("createMatch.pickLater")}
              </Text>
            ) : null}

            <Slider
              value={levelRange}
              onChange={(value) => Array.isArray(value) && setLevelRange([value[0], value[1]])}
              minValue={MIN_LEVEL}
              maxValue={MAX_LEVEL}
              step={0.5}
              className="gap-2"
            >
              <View className="flex-row items-baseline justify-between">
                <Text className="font-bold text-[14px] text-foreground">{t("createMatch.levelRange")}</Text>
                <Text className="font-black text-[15px] text-accent">
                  {levelRange[0].toFixed(1)} – {levelRange[1].toFixed(1)}
                </Text>
              </View>
              <Slider.Track>
                {({ state }) => (
                  <>
                    <Slider.Fill />
                    {state.values.map((_, i) => (
                      <Slider.Thumb key={i} index={i} />
                    ))}
                  </>
                )}
              </Slider.Track>
              <View className="flex-row justify-between">
                <Text className="font-semibold text-[12px] text-muted">{MIN_LEVEL.toFixed(1)}</Text>
                <Text className="font-semibold text-[12px] text-muted">
                  {t("level.yours", { level: myLevel.toFixed(1) })}
                </Text>
                <Text className="font-semibold text-[12px] text-muted">{MAX_LEVEL.toFixed(1)}</Text>
              </View>
            </Slider>

            <View className="flex-row gap-2.5">
              <Field label={t("createMatch.matchType")} className="flex-1">
                <Dropdown
                  label={t("createMatch.matchType")}
                  placeholder={t("match.kind.friendly")}
                  options={kindOptions}
                  value={kindOptions.find((option) => option.value === kind)}
                  onChange={(option) => option && setKind(option.value as MatchKind)}
                />
              </Field>
              <Field label={t("createMatch.playersNeeded")} className="flex-1">
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
              </Field>
            </View>

            {kind === "friendly" ? (
              <InfoNote icon={Info} title={t("createMatch.friendlyTitle")}>
                {t("createMatch.friendlyText")}
              </InfoNote>
            ) : (
              <InfoNote icon={Trophy} title={t("createMatch.competitiveTitle")}>
                {t("createMatch.competitiveText")}
              </InfoNote>
            )}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** Label above a field (14 px / 800), with optional muted detail after it */
function Field({
  label,
  detail,
  className,
  children,
}: {
  label: string;
  detail?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="font-bold text-[14px] text-foreground">
        {label}
        {detail ? <Text className="font-semibold text-muted"> {detail}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

type DateFieldProps = {
  value: Date;
  minimumDate: Date;
  maximumDate: Date;
  accentColor: string;
  onChange: (date: Date) => void;
};

/**
 * Date field. iOS shows its compact picker inside the box. On Android the picker is a dialog
 * that opens the moment it is mounted, so it is only mounted while the player is choosing a date.
 */
function DateField({ value, minimumDate, maximumDate, accentColor, onChange }: DateFieldProps) {
  const [isPicking, setIsPicking] = useState(false);

  if (Platform.OS !== "android") {
    return (
      <PickerBox>
        <DateTimePicker
          value={value}
          mode="date"
          display="compact"
          locale={dateLocale()}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={accentColor}
          themeVariant="light"
          onValueChange={(_, date) => onChange(date)}
          onChange={(_, date) => date && onChange(date)}
        />
      </PickerBox>
    );
  }

  return (
    <>
      <GesturePressable onPress={() => setIsPicking(true)} accessibilityRole="button">
        <PickerBox>
          <Icon as={CalendarDays} size={18} color="accent" />
          <Text className="font-semibold text-[15px] text-foreground">{formatMatchDay(value)}</Text>
        </PickerBox>
      </GesturePressable>
      {isPicking ? (
        <DateTimePicker
          value={value}
          mode="date"
          presentation="dialog"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          accentColor={accentColor}
          onValueChange={(_, date) => {
            setIsPicking(false);
            onChange(date);
          }}
          onDismiss={() => setIsPicking(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Field box around the native date picker (or the button that opens it on Android).
 */
function PickerBox({ children }: { children: ReactNode }) {
  return (
    <View className="h-[52px] flex-row items-center gap-1.5 rounded-[14px] border border-line-input bg-surface px-2">
      {children}
    </View>
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
