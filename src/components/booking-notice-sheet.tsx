import { BottomSheet, Button, Checkbox } from "heroui-native";
import { Phone } from "lucide-react-native";
import { useState } from "react";
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
                Book your court first
              </BottomSheet.Title>
              <BottomSheet.Close className="size-10 rounded-full bg-fill" />
            </View>
            <BottomSheet.Description className="font-normal text-[15px] leading-[22px] text-ink-2">
              Court availability isn’t shown in the app yet. Call the club to check a free slot and
              reserve it, then create your match.
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
                accessibilityLabel={`Call ${clubName}`}
                className="h-11 gap-1.5 rounded-[14px] bg-call px-4"
              >
                <Icon as={Phone} size={18} color="accent-foreground" />
                <Button.Label className="text-[15px]">Call</Button.Label>
              </Button>
            </View>
          ) : null}

          <View className="flex-row items-center gap-2.5 rounded-2xl border border-dashed border-primary-outline px-3 py-2.5">
            <Text className="overflow-hidden rounded-lg bg-lime px-2 py-1 font-black text-[11px] uppercase tracking-[0.6px] text-lime-foreground">
              Soon
            </Text>
            <Text className="flex-1 font-normal text-[13px] leading-[18px] text-ink-2">
              You’ll be able to see free slots and book courts right here in the app.
            </Text>
          </View>

          <View className="flex-row items-center gap-2.5">
            <Checkbox
              isSelected={dontShowAgain}
              onSelectedChange={setDontShowAgain}
              accessibilityLabel="Don’t show this again"
            />
            <Pressable onPress={() => setDontShowAgain((value) => !value)} className="flex-1">
              <Text className="font-normal text-[14px] text-ink-2">Don’t show this again</Text>
            </Pressable>
          </View>

          <Button size="lg" onPress={handleCreate}>
            Got it, create match
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
