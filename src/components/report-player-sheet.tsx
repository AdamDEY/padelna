import {
  BottomSheetFooter,
  BottomSheetScrollView,
  type BottomSheetFooterProps,
  type BottomSheetScrollViewMethods,
} from "@gorhom/bottom-sheet";
import {
  BottomSheet,
  Button,
  cn,
  TextArea,
  useBottomSheetAwareHandlers,
  useToast,
} from "heroui-native";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PlayerAvatar } from "@/components/player-avatar";
import { SegmentedControl } from "@/components/segmented-control";
import {
  MAX_REPORT_COMMENT,
  REPORT_REASONS,
  type ReportReason,
} from "@/data/report-reasons";
import { useReportPlayer } from "@/hooks/usePlayers";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDay } from "@/lib/format-date";
import type { Player } from "@/types/player";

// Room the pinned Send button and its note take, so the comment can scroll above them
const FOOTER_SPACE = 150;
// Radio circle and its dot (design: 20 px radio)
const RADIO_SIZE = 20;
const RADIO_DOT_SIZE = 10;

type ReportPlayerSheetProps = {
  /** The player being reported; keep passing the last one while the sheet closes */
  player: Player | undefined;
  /** When you last played together, shown under the name */
  lastPlayedTogetherAt?: Date;
  /** Whether the app knows you played a match together; it pre-fills the question */
  playedTogether?: boolean;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Report a player" bottom sheet (design canvas "Report a player"): why, an optional comment,
 * Send report. The report is confidential; the reported player never sees who sent it.
 */
export function ReportPlayerSheet({
  player,
  lastPlayedTogetherAt,
  playedTogether = false,
  isOpen,
  onOpenChange,
}: ReportPlayerSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const report = useReportPlayer();

  const [reason, setReason] = useState<ReportReason | null>(null);
  // Until you answer, it follows what the app knows about your matches together
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const playedWith = (answer ?? (playedTogether ? "yes" : "no")) === "yes";
  const [comment, setComment] = useState("");
  const scrollRef = useRef<BottomSheetScrollViewMethods>(null);

  // Closing clears the form, so the next report starts fresh
  function handleOpenChange(open: boolean) {
    if (!open) {
      setReason(null);
      setAnswer(null);
      setComment("");
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }
    onOpenChange(open);
  }

  async function submit() {
    if (!player || !reason) return;
    try {
      await report.mutateAsync({ playerId: player.id, reason, playedTogether: playedWith, comment });
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("reportPlayer.failed"),
        description: errorMessage(error),
      });
      return;
    }
    toast.show({
      variant: "success",
      label: t("reportPlayer.sent"),
      description: t("reportPlayer.sentText"),
    });
    handleOpenChange(false);
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["94%"]}
          enableDynamicSizing={false}
          enableOverDrag={false}
          keyboardBehavior="extend"
          keyboardBlurBehavior="restore"
          contentContainerClassName="h-full p-0"
          backgroundClassName="bg-background"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
          footerComponent={(props: BottomSheetFooterProps) => (
            // Send stays pinned at the bottom while the form scrolls
            <BottomSheetFooter {...props}>
              <View
                className="gap-2 bg-background px-5 pt-3"
                style={{ paddingBottom: Math.max(insets.bottom, 34) }}
              >
                <Text className="text-center font-normal text-[12px] leading-[17px] text-muted">
                  {t("reportPlayer.reviewNote")}
                </Text>
                <Button
                  size="lg"
                  isDisabled={!reason || report.isPending}
                  onPress={submit}
                  className="h-[54px] rounded-[18px] bg-attention-action"
                >
                  <Button.Label className="text-[17px] text-white">
                    {t("reportPlayer.send")}
                  </Button.Label>
                </Button>
              </View>
            </BottomSheetFooter>
          )}
        >
          <View className="flex-row items-center gap-3 px-5 pb-3 pt-1">
            {player ? <PlayerAvatar player={player} size={36} /> : null}
            <View className="min-w-0 flex-1">
              <BottomSheet.Title
                numberOfLines={1}
                className="font-black text-[20px] tracking-[-0.3px] text-foreground"
              >
                {t("reportPlayer.title", {
                  name: player
                    ? `${player.firstName} ${player.lastName.charAt(0).toLocaleUpperCase()}.`
                    : "",
                })}
              </BottomSheet.Title>
              {lastPlayedTogetherAt ? (
                <BottomSheet.Description
                  numberOfLines={1}
                  className="font-normal text-[12px] text-muted"
                >
                  {t("reportPlayer.lastMatch", {
                    date: formatMatchDay(lastPlayedTogetherAt),
                  })}
                </BottomSheet.Description>
              ) : null}
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-surface" />
          </View>

          <BottomSheetScrollView
            ref={scrollRef}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingBottom: FOOTER_SPACE,
              gap: 14,
            }}
          >
            <Text className="font-normal text-[14px] leading-[20px] text-ink-2">
              {t("reportPlayer.confidential", {
                name: player?.firstName ?? "",
              })}
            </Text>

            <View className="gap-2">
              <Text className="font-black text-[15px] text-foreground">
                {t("reportPlayer.playedWith", { name: player?.firstName ?? "" })}
              </Text>
              <SegmentedControl
                options={[
                  { value: "yes", label: t("reportPlayer.yes") },
                  { value: "no", label: t("reportPlayer.no") },
                ]}
                value={playedWith ? "yes" : "no"}
                onChange={setAnswer}
              />
            </View>

            <View className="gap-2">
              <Text className="font-black text-[15px] text-foreground">
                {t("reportPlayer.whatHappened")}
              </Text>
              <View
                accessibilityRole="radiogroup"
                className="overflow-hidden rounded-[18px] border border-line bg-surface"
              >
                {REPORT_REASONS.map((item, index) => (
                  <ReasonRow
                    key={item}
                    label={t(`reportPlayer.reasons.${item}`)}
                    selected={item === reason}
                    isLast={index === REPORT_REASONS.length - 1}
                    onPress={() => setReason(item)}
                  />
                ))}
              </View>
            </View>

            <View className="gap-1.5">
              <View className="flex-row items-baseline justify-between">
                <Text className="font-black text-[15px] text-foreground">
                  {t("reportPlayer.tellUsMore")}{" "}
                  <Text className="font-medium text-muted">
                    {t("reportPlayer.optional")}
                  </Text>
                </Text>
                <Text className="font-normal text-[12px] text-muted">
                  {comment.length}/{MAX_REPORT_COMMENT}
                </Text>
              </View>
              <CommentField
                value={comment}
                onChange={setComment}
                // The comment is last: once the keyboard is up, bring it into view
                onFocused={() =>
                  setTimeout(
                    () => scrollRef.current?.scrollToEnd({ animated: true }),
                    300,
                  )
                }
              />
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

type ReasonRowProps = {
  label: string;
  selected: boolean;
  isLast: boolean;
  onPress: () => void;
};

/** One reason: a radio row, 44 px tall like the design. */
function ReasonRow({ label, selected, isLast, onPress }: ReasonRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className={cn(
        "min-h-11 flex-row items-center gap-3 px-3.5",
        !isLast && "border-b border-fill",
      )}
    >
      <View
        style={{ width: RADIO_SIZE, height: RADIO_SIZE }}
        className={cn(
          "items-center justify-center rounded-full border-2",
          selected ? "border-attention-action" : "border-line-input",
        )}
      >
        {selected ? (
          <View
            style={{ width: RADIO_DOT_SIZE, height: RADIO_DOT_SIZE }}
            className="rounded-full bg-attention-action"
          />
        ) : null}
      </View>
      <Text
        className={cn(
          "flex-1 text-[15px] text-foreground",
          selected ? "font-bold" : "font-semibold",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** Comment box that lifts the sheet when the keyboard opens */
function CommentField({
  value,
  onChange,
  onFocused,
}: {
  value: string;
  onChange: (text: string) => void;
  onFocused: () => void;
}) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <TextArea
      value={value}
      onChangeText={onChange}
      onFocus={(event) => {
        onFocus(event);
        onFocused();
      }}
      onBlur={onBlur}
      maxLength={MAX_REPORT_COMMENT}
      placeholder={t("reportPlayer.placeholder")}
      accessibilityLabel={t("reportPlayer.tellUsMore")}
      numberOfLines={3}
      className="min-h-20"
    />
  );
}
