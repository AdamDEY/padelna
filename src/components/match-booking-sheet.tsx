import { BottomSheet, Button, useToast } from "heroui-native";
import { BellRing, Clock } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { CourtFields } from "@/components/court-fields";
import type { DropdownOption } from "@/components/dropdown";
import { InfoNote } from "@/components/info-note";
import { useBookableClubs } from "@/hooks/useClubs";
import { useSetMatchCourt } from "@/hooks/useMatches";
import { errorMessage } from "@/lib/error-message";
import type { MatchDetails } from "@/types/match";

type MatchBookingSheetProps = {
  match: MatchDetails;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * "Booking" from the host tools: add the club and court once booked, move the match to another
 * court, or mark it as not booked again. Works after players joined; they get a chat note.
 */
export function MatchBookingSheet({ match, isOpen, onOpenChange }: MatchBookingSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const clubs = useBookableClubs();
  const setMatchCourt = useSetMatchCourt();

  // Until the host changes a field, it shows the current booking
  const [pickedBooked, setIsBooked] = useState<boolean>();
  const [pickedClub, setClub] = useState<DropdownOption | null>();
  const [pickedCourt, setCourt] = useState<DropdownOption | null>();
  const isBooked = pickedBooked ?? match.isCourtBooked;
  const currentClub = match.clubId ? { value: match.clubId, label: match.clubName } : undefined;
  const currentNumber = clubs
    .find((item) => item.id === match.clubId)
    ?.courts.find((item) => item.id === match.courtId)?.number;
  const currentCourt =
    match.courtId && currentNumber !== undefined
      ? { value: match.courtId, label: String(currentNumber) }
      : undefined;
  // null means the host cleared it (picking another club clears the court)
  const club = pickedClub === undefined ? currentClub : pickedClub ?? undefined;
  const court = pickedCourt === undefined ? currentCourt : pickedCourt ?? undefined;

  const courtId = isBooked ? court?.value : undefined;
  const hasChanges = (courtId ?? null) !== (match.courtId ?? null);
  const canSave = hasChanges && (!isBooked || court !== undefined) && !setMatchCourt.isPending;

  function handleOpenChange(open: boolean) {
    if (!open) {
      setIsBooked(undefined);
      setClub(undefined);
      setCourt(undefined);
    }
    onOpenChange(open);
  }

  function save() {
    setMatchCourt.mutate(
      { matchId: match.id, courtId: courtId ?? null },
      {
        onSuccess: () => {
          toast.show({
            variant: "success",
            label: t("matchBooking.saved"),
            description: courtId ? undefined : t("matchBooking.savedNotBooked"),
          });
          handleOpenChange(false);
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: t("matchBooking.saveFailed"), description: errorMessage(error) }),
      },
    );
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-3.5 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="gap-1.5">
            <View className="flex-row items-center justify-between gap-3">
              <BottomSheet.Title className="flex-1 font-black text-[24px] tracking-[-0.4px] text-foreground">
                {t("matchBooking.title")}
              </BottomSheet.Title>
              <BottomSheet.Close className="size-10 rounded-full bg-fill" />
            </View>
            <BottomSheet.Description className="font-normal text-[15px] leading-[22px] text-ink-2">
              {t("matchBooking.text")}
            </BottomSheet.Description>
          </View>

          <CourtFields
            clubs={clubs}
            isBooked={isBooked}
            onBookedChange={setIsBooked}
            club={club}
            onClubChange={(option) => setClub(option ?? null)}
            court={court}
            onCourtChange={(option) => setCourt(option ?? null)}
          />

          {isBooked ? null : (
            <InfoNote icon={Clock} tone="warning" title={t("matchBooking.notBookedTitle")}>
              {t("matchBooking.notBookedText")}
            </InfoNote>
          )}
          {match.hasJoinedPlayers && hasChanges ? (
            <InfoNote icon={BellRing} title={t("matchBooking.playersToldTitle")}>
              {t("matchBooking.playersToldText")}
            </InfoNote>
          ) : null}

          <Button size="lg" isDisabled={!canSave} onPress={save} className="mt-1">
            {t("matchBooking.save")}
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
