import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { DateTimePicker } from "@expo/ui/community/datetime-picker";
import { BottomSheet, Button, cn, Select, Slider, useToast } from "heroui-native";
import { Check, ChevronDown, Clock, Info, MapPin, Minus, Plus, Trophy } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
// Gesture Handler's Pressable: React Native's doesn't get taps inside the sheet
import {
  Pressable as GesturePressable,
  ScrollView as GestureScrollView,
} from "react-native-gesture-handler";
import { useCSSVariable } from "uniwind";

import { Icon } from "@/components/icon";
import { InfoNote } from "@/components/info-note";
import { SegmentedControl } from "@/components/segmented-control";
import { allClubs, myLevel } from "@/data/mock";
import { daysUntil, formatMatchDay } from "@/lib/format-date";

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

// Tallest a dropdown list gets before it scrolls
const LIST_MAX_HEIGHT = 360;

type MatchKind = "friendly" | "competitive";
type Option = { value: string; label: string };

const kindOptions: Option[] = [
  { value: "friendly", label: "Friendly" },
  { value: "competitive", label: "Competitive" },
];

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function dayLabel(date: Date) {
  const days = daysUntil(date);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return formatMatchDay(date);
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

function defaultLevelRange(): [number, number] {
  return [Math.max(MIN_LEVEL, myLevel - 0.5), Math.min(MAX_LEVEL, myLevel + 0.5)];
}

type CreateMatchSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Create a match" bottom sheet (design: Create match (sheet)). With a booked
 * court you pick the club and court; without one, a note says to add them once
 * booked. The match type explains whether the result counts toward your level.
 */
export function CreateMatchSheet({ isOpen, onOpenChange }: CreateMatchSheetProps) {
  const { toast } = useToast();
  const accent = useCSSVariable("--color-accent") as string;
  const clubs = [...allClubs].sort((a, b) => a.distanceKm - b.distanceKm);
  const [now] = useState(() => new Date());
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + DAYS_AHEAD);

  const [isBooked, setIsBooked] = useState(true);
  const [club, setClub] = useState<Option | undefined>();
  const [court, setCourt] = useState<Option | undefined>();
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [levelRange, setLevelRange] = useState<[number, number]>(defaultLevelRange);
  const [kind, setKind] = useState<Option>(kindOptions[0]);
  const [playersNeeded, setPlayersNeeded] = useState(2);

  const selectedClub = clubs.find((item) => item.id === club?.value);
  const courtOptions: Option[] = Array.from({ length: selectedClub?.courtCount ?? 0 }, (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }));
  const endsAt = new Date(startsAt.getTime() + MATCH_MINUTES * 60_000);
  // A booked court needs the club and court; otherwise those come later
  const canPublish = !isBooked || (club !== undefined && court !== undefined);

  function handleOpenChange(open: boolean) {
    if (!open) {
      // Start the next match from a clean form
      setIsBooked(true);
      setClub(undefined);
      setCourt(undefined);
      setStartsAt(defaultStart());
      setLevelRange(defaultLevelRange());
      setKind(kindOptions[0]);
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

  function publish() {
    // Nothing is saved yet; the API will create the match
    const when = `${dayLabel(startsAt)} · ${formatTime(startsAt)}`;
    toast.show({
      variant: "success",
      label: "Match published",
      description:
        isBooked && club
          ? `${when} at ${club.label}, Court ${court?.value}. Players at your level can join.`
          : `${when}. Add the club and court once you've booked.`,
    });
    handleOpenChange(false);
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
                  Publish match
                </Button>
              </View>
            </BottomSheetFooter>
          )}
        >
          <View className="flex-row items-center justify-between px-5 pb-3 pt-1">
            <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
              Create a match
            </BottomSheet.Title>
            <BottomSheet.Close className="size-10 rounded-full bg-fill" />
          </View>

          <BottomSheetScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: FOOTER_SPACE, gap: 14 }}
          >
            <Field label="Is the court booked?">
              <SegmentedControl
                value={isBooked ? "yes" : "no"}
                onChange={(value) => setIsBooked(value === "yes")}
                options={[
                  { value: "yes", label: "Yes, booked", icon: Check },
                  { value: "no", label: "Not yet" },
                ]}
              />
            </Field>

            {isBooked ? (
              <View className="flex-row gap-2.5">
                <Field label="Club" className="flex-[2]">
                  <Dropdown
                    label="Club"
                    icon={MapPin}
                    placeholder="Choose a club"
                    options={clubs.map((item) => ({ value: item.id, label: item.name }))}
                    value={club}
                    onChange={(option) => {
                      setClub(option);
                      setCourt(undefined);
                    }}
                  />
                </Field>
                <Field label="Court no." className="flex-1">
                  <Dropdown
                    label="Court number"
                    placeholder="–"
                    options={courtOptions}
                    value={court}
                    onChange={setCourt}
                    isDisabled={!selectedClub}
                  />
                </Field>
              </View>
            ) : (
              <InfoNote icon={Clock} tone="warning" title="Book your court first.">
                You can publish now and add the club and court once it&apos;s booked. Players will see
                &quot;Not booked yet&quot; until then.
              </InfoNote>
            )}

            <View className="flex-row gap-2.5">
              <Field label="Date" className="flex-1">
                <PickerBox>
                  <DateTimePicker
                    value={startsAt}
                    mode="date"
                    display="compact"
                    locale="en-GB"
                    minimumDate={now}
                    maximumDate={lastDay}
                    accentColor={accent}
                    themeVariant="light"
                    onValueChange={(_, date) => setDay(date)}
                    onChange={(_, date) => date && setDay(date)}
                  />
                </PickerBox>
              </Field>
              <Field
                label="Time"
                detail={`· ${MATCH_MINUTES} min`}
                className="flex-1"
              >
                <Dropdown
                  label="Start time"
                  placeholder="18:00"
                  options={TIME_OPTIONS}
                  value={timeValue}
                  onChange={(option) => option && setTime(option.value)}
                  suffix={`– ${formatTime(endsAt)}`}
                />
              </Field>
            </View>

            <Slider
              value={levelRange}
              onChange={(value) => Array.isArray(value) && setLevelRange([value[0], value[1]])}
              minValue={MIN_LEVEL}
              maxValue={MAX_LEVEL}
              step={0.5}
              className="gap-2"
            >
              <View className="flex-row items-baseline justify-between">
                <Text className="font-bold text-[14px] text-foreground">Level range</Text>
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
                  Your level {myLevel.toFixed(1)}
                </Text>
                <Text className="font-semibold text-[12px] text-muted">{MAX_LEVEL.toFixed(1)}</Text>
              </View>
            </Slider>

            <View className="flex-row gap-2.5">
              <Field label="Match type" className="flex-1">
                <Dropdown
                  label="Match type"
                  placeholder="Friendly"
                  options={kindOptions}
                  value={kind}
                  onChange={(option) => option && setKind(option)}
                />
              </Field>
              <Field label="Players needed" className="flex-1">
                <View className="h-[52px] flex-row items-center justify-between rounded-[14px] border border-line-input bg-surface px-1.5">
                  <StepButton
                    icon={Minus}
                    label="Fewer players"
                    disabled={playersNeeded <= 1}
                    onPress={() => setPlayersNeeded((n) => Math.max(1, n - 1))}
                  />
                  <Text
                    accessibilityLiveRegion="polite"
                    accessibilityLabel={`${playersNeeded} players needed`}
                    className="font-black text-[18px] text-foreground"
                  >
                    {playersNeeded}
                  </Text>
                  <StepButton
                    icon={Plus}
                    label="More players"
                    disabled={playersNeeded >= 3}
                    onPress={() => setPlayersNeeded((n) => Math.min(3, n + 1))}
                  />
                </View>
              </Field>
            </View>

            {(kind.value as MatchKind) === "friendly" ? (
              <InfoNote icon={Info} title="Just for fun.">
                The result won&apos;t change your level.
              </InfoNote>
            ) : (
              <InfoNote icon={Trophy} title="This one counts.">
                Once all 4 players confirm the score, the result is used to adjust your level.
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

/**
 * Dropdown field (HeroUI Select). The trigger is a Gesture Handler pressable
 * that opens the list itself, since Select's own trigger doesn't get taps here.
 */
function Dropdown({
  label,
  icon,
  placeholder,
  options,
  value,
  onChange,
  isDisabled,
  suffix,
}: {
  label: string;
  icon?: typeof MapPin;
  placeholder: string;
  options: Option[];
  value: Option | undefined;
  onChange: (option: Option | undefined) => void;
  isDisabled?: boolean;
  /** Muted text after the value, e.g. the end time */
  suffix?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Select
      value={value}
      onValueChange={(option) => {
        onChange(option);
        setIsOpen(false);
      }}
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      isDisabled={isDisabled}
      presentation="dialog"
    >
      <View className={cn("h-[52px]", isDisabled && "opacity-50")}>
        <GesturePressable
          onPress={() => setIsOpen(true)}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${value?.label ?? "not chosen"}`}
          accessibilityHint="Opens a list to choose from"
          style={{ flex: 1 }}
        >
          <View className="flex-1 flex-row items-center gap-2 rounded-[14px] border border-line-input bg-surface px-3">
            {icon ? <Icon as={icon} size={18} color="accent" /> : null}
            <Text
              numberOfLines={1}
              className={cn(
                "flex-1 font-semibold text-[15px]",
                value ? "text-foreground" : "text-muted",
              )}
            >
              {value?.label ?? placeholder}
              {suffix ? <Text className="text-muted"> {suffix}</Text> : null}
            </Text>
            <Icon as={ChevronDown} size={16} color="muted" />
          </View>
        </GesturePressable>
      </View>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="dialog">
          <Select.ListLabel className="mb-2">{label}</Select.ListLabel>
          {/* Long lists (half-hour times) scroll instead of running off the screen */}
          <GestureScrollView style={{ maxHeight: LIST_MAX_HEIGHT }} showsVerticalScrollIndicator>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} label={option.label} />
            ))}
          </GestureScrollView>
        </Select.Content>
      </Select.Portal>
    </Select>
  );
}

/**
 * Field box around the native date picker. iOS shows its compact picker
 * inside; Android opens the system dialog from it.
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
