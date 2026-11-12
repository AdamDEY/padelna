import { BottomSheet, Button, Checkbox } from "heroui-native";
import { Phone } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { setSkipBookingNotice } from "@/lib/booking-notice";

type BookingNoticeSheetProps = {
  clubName: string;
  /** Club phone, shown with a Call button when known */
  phone?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called when the host chooses to go on and create the match */
  onCreate: () => void;
};

/**
 * "Book your court first" notice on a club page (design: Create match here ·
 * check availability notice). Court availability isn't in the app yet, so the
 * host is asked to call the club before creating the match.
 */
export function BookingNoticeSheet({
  clubName,
  phone,
  isOpen,
  onOpenChange,
  onCreate,
}: BookingNoticeSheetProps) {
  const { t } = useTranslation();
  const [dontShowAgain, setDontShowAgain] = useState(false);

  function handleCreate() {
    if (dontShowAgain) void setSkipBookingNotice(true);
    onCreate();
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          {/* Same header as the Create match sheet it leads to */}
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between gap-3">
              <BottomSheet.Title className="flex-1 font-black text-[24px] tracking-[-0.4px] text-foreground">
                {t("bookingNotice.title")}
              </BottomSheet.Title>
              <BottomSheet.Close className="size-10 rounded-full bg-fill" />
            </View>
            <BottomSheet.Description className="font-normal text-[15px] leading-[22px] text-ink-2">
              {t("bookingNotice.text")}
            </BottomSheet.Description>
          </View>

          {phone ? (
            <View className="flex-row items-center gap-3 rounded-[18px] bg-background py-3 pe-3 ps-3.5">
              <View className="flex-1">
                <Text className="font-normal text-[13px] text-muted">{clubName}</Text>
                <Text className="font-black text-[18px] tracking-[0.3px] text-foreground">
                  {phone}
                </Text>
              </View>
              <Button
                onPress={() => Linking.openURL(`tel:${phone.replace(/\s/g, "")}`)}
                accessibilityLabel={t("bookingNotice.callA11y", { club: clubName })}
                className="h-11 gap-1.5 rounded-[14px] bg-call px-4"
              >
                <Icon as={Phone} size={18} color="accent-foreground" />
                <Button.Label className="text-[15px]">{t("bookingNotice.call")}</Button.Label>
              </Button>
            </View>
          ) : null}

          <View className="flex-row items-center gap-2.5 rounded-2xl border border-dashed border-primary-outline px-3 py-2.5">
            <Text className="overflow-hidden rounded-lg bg-lime px-2 py-1 font-black text-[11px] uppercase tracking-[0.6px] text-on-lime">
              {t("bookingNotice.soon")}
            </Text>
            <Text className="flex-1 font-normal text-[13px] leading-[18px] text-ink-2">
              {t("bookingNotice.soonText")}
            </Text>
          </View>

          <View className="flex-row items-center gap-2.5">
            <Checkbox
              isSelected={dontShowAgain}
              onSelectedChange={setDontShowAgain}
              accessibilityLabel={t("bookingNotice.dontShow")}
            />
            <Pressable onPress={() => setDontShowAgain((value) => !value)} className="flex-1">
              <Text className="font-normal text-[14px] text-ink-2">{t("bookingNotice.dontShow")}</Text>
            </Pressable>
          </View>

          <Button size="lg" onPress={handleCreate}>
            {t("bookingNotice.create")}
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
