import { BottomSheet, Button, cn, TextArea, useBottomSheetAwareHandlers, useToast } from "heroui-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FEEDBACK_KINDS, MAX_FEEDBACK_MESSAGE, type FeedbackKind } from "@/data/feedback-kinds";
import { useSubmitFeedback } from "@/hooks/useFeedback";
import { errorMessage } from "@/lib/error-message";

type FeedbackSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** The route the player was on when they shook the phone */
  screen: string;
  /** Opens Settings, where shake to report can be turned off */
  onOpenSettings: () => void;
};

/**
 * "Help us improve Padelna" bottom sheet (design canvas "Shake to send feedback · bottom sheet"):
 * Bug / Idea / Other, a message and Send. The sender's profile id and full name are added by the
 * database from their session.
 */
export function FeedbackSheet({ isOpen, onOpenChange, screen, onOpenSettings }: FeedbackSheetProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const submitFeedback = useSubmitFeedback();

  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [message, setMessage] = useState("");
  const canSend = message.trim().length > 0 && !submitFeedback.isPending;

  // Closing clears the form, so the next one starts fresh
  function handleOpenChange(open: boolean) {
    if (!open) {
      setKind("bug");
      setMessage("");
    }
    onOpenChange(open);
  }

  async function send() {
    try {
      await submitFeedback.mutateAsync({ kind, message: message.trim(), screen });
    } catch (error) {
      toast.show({ variant: "danger", label: t("feedback.failed"), description: errorMessage(error) });
      return;
    }
    toast.show({ variant: "success", label: t("feedback.thanks"), description: t("feedback.thanksText") });
    handleOpenChange(false);
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          style={{ paddingBottom: Math.max(insets.bottom, 34) }}
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-4 px-5 pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-start gap-3">
            <View className="flex-1 gap-[3px]">
              <BottomSheet.Title className="font-black text-[22px] tracking-[-0.3px] text-foreground">
                {t("feedback.title")}
              </BottomSheet.Title>
              <BottomSheet.Description className="font-normal text-[14px] leading-[20px] text-muted">
                {t("feedback.subtitle")}
              </BottomSheet.Description>
            </View>
            <BottomSheet.Close className="size-9 rounded-full bg-surface" />
          </View>

          <View accessibilityRole="radiogroup" className="flex-row gap-2.5">
            {FEEDBACK_KINDS.map((item) => (
              <KindChip
                key={item}
                label={t(`feedback.kinds.${item}`)}
                selected={item === kind}
                onPress={() => setKind(item)}
              />
            ))}
          </View>

          <View className="gap-2">
            <Text className="font-bold text-[14px] text-foreground">{t(`feedback.labels.${kind}`)}</Text>
            <View>
              <MessageField
                value={message}
                onChange={setMessage}
                placeholder={t(`feedback.placeholders.${kind}`)}
                label={t(`feedback.labels.${kind}`)}
              />
              <Text className="absolute bottom-2.5 end-3.5 font-bold text-[12px] text-muted">
                {message.length} / {MAX_FEEDBACK_MESSAGE}
              </Text>
            </View>
          </View>

          <Button size="lg" isDisabled={!canSend} onPress={send}>
            {t("feedback.send")}
          </Button>

          <Text className="-mt-1 text-center font-normal text-[12px] text-muted">
            {t("feedback.turnOffPrefix")}{" "}
            <Text
              accessibilityRole="link"
              onPress={() => {
                handleOpenChange(false);
                onOpenSettings();
              }}
              className="font-bold text-accent"
            >
              {t("feedback.settings")}
            </Text>
          </Text>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** One of Bug / Idea / Other: selected = primary-soft with a 2 px primary border. */
function KindChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      className={cn(
        "h-[52px] flex-1 items-center justify-center rounded-2xl",
        selected ? "border-2 border-accent bg-primary-soft" : "border border-line-input bg-surface",
      )}
    >
      <Text
        className={cn(
          "text-[15px]",
          selected ? "font-black text-primary-dark" : "font-bold text-foreground",
        )}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** The message box; tells the sheet about the keyboard so it moves above it. */
function MessageField({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (text: string) => void;
  placeholder: string;
  label: string;
}) {
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <TextArea
      value={value}
      onChangeText={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      maxLength={MAX_FEEDBACK_MESSAGE}
      placeholder={placeholder}
      accessibilityLabel={label}
      numberOfLines={5}
      // Room under the text for the counter
      className="h-[132px] pb-7"
    />
  );
}
