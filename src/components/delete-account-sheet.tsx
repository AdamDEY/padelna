import { BottomSheet, Button, Input, Label, TextField, useBottomSheetAwareHandlers } from "heroui-native";
import { CalendarDays, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { formatMatchDay } from "@/lib/format-date";

type DeleteAccountSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the player loses, one line each */
  losses: string[];
  /** A match you host that would be cancelled */
  hostedMatch?: { startsAt: Date; otherPlayerCount: number };
  onDelete: () => void;
};

/** "Delete your account?" confirmation: what you lose, then type DELETE to confirm. */
export function DeleteAccountSheet({
  isOpen,
  onOpenChange,
  losses,
  hostedMatch,
  onDelete,
}: DeleteAccountSheetProps) {
  const { t } = useTranslation();
  // Typing a word, not just tapping, makes an accidental delete unlikely
  const confirmWord = t("deleteAccount.word");
  const [confirmation, setConfirmation] = useState("");
  const isConfirmed = confirmation.trim().toUpperCase() === confirmWord;

  // Closing clears the word, so the next attempt starts over
  function handleOpenChange(open: boolean) {
    if (!open) setConfirmation("");
    onOpenChange(open);
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          keyboardBehavior="interactive"
          keyboardBlurBehavior="restore"
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="items-center gap-2.5">
            <View className="size-14 items-center justify-center rounded-full bg-danger-soft">
              <Icon as={Trash2} size={28} color="danger" />
            </View>
            <BottomSheet.Title className="text-center font-black text-[22px] tracking-[-0.3px] text-foreground">
              {t("deleteAccount.title")}
            </BottomSheet.Title>
            <BottomSheet.Description className="text-center font-normal text-[15px] leading-[22px] text-ink-2">
              {t("deleteAccount.description")}
            </BottomSheet.Description>
          </View>

          <View className="gap-2 rounded-[18px] bg-background px-3.5 py-3">
            {losses.map((loss) => (
              <View key={loss} className="flex-row items-center gap-2.5">
                <View className="size-1.5 rounded-full bg-danger" />
                <Text className="flex-1 font-semibold text-[14px] text-foreground">{loss}</Text>
              </View>
            ))}
          </View>

          {hostedMatch ? (
            <View className="flex-row items-start gap-2.5 rounded-[14px] bg-warning-soft px-3 py-2.5">
              <Icon as={CalendarDays} size={18} color="warning" />
              <Text className="flex-1 font-normal text-[13px] leading-[18px] text-warning">
                {t("deleteAccount.hostingPrefix")}{" "}
                <Text className="font-bold">{formatMatchDay(hostedMatch.startsAt)}</Text>
                {t("deleteAccount.hostingSuffix", { count: hostedMatch.otherPlayerCount })}
              </Text>
            </View>
          ) : null}

          <ConfirmField word={confirmWord} value={confirmation} onChange={setConfirmation} />

          <View className="gap-2">
            <Button size="lg" variant="danger" isDisabled={!isConfirmed} onPress={onDelete}>
              {t("deleteAccount.delete")}
            </Button>
            <Button size="lg" variant="ghost" onPress={() => handleOpenChange(false)}>
              <Button.Label className="text-foreground">{t("deleteAccount.keep")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

/** The "Type DELETE" field; tells the sheet about the keyboard so it moves above it. */
function ConfirmField({
  word,
  value,
  onChange,
}: {
  word: string;
  value: string;
  onChange: (text: string) => void;
}) {
  const { t } = useTranslation();
  const { onFocus, onBlur } = useBottomSheetAwareHandlers();

  return (
    <TextField>
      {/* Label only takes plain text, so the bold word sits next to it */}
      <View className="flex-row items-baseline gap-1">
        <Label>{t("deleteAccount.type")}</Label>
        <Text className="font-black text-[14px] text-foreground">{word}</Text>
        <Label>{t("deleteAccount.toConfirm")}</Label>
      </View>
      <Input
        value={value}
        onChangeText={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        accessibilityLabel={t("deleteAccount.typeA11y", { word })}
        className="font-bold tracking-[1px]"
      />
    </TextField>
  );
}
