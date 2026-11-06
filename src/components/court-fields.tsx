import { Check, MapPin } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { SegmentedControl } from "@/components/segmented-control";
import { SheetField } from "@/components/sheet-field";
import type { useBookableClubs } from "@/hooks/useClubs";

type CourtFieldsProps = {
  /** Clubs that can host matches, with their active courts */
  clubs: ReturnType<typeof useBookableClubs>;
  isBooked: boolean;
  /** Leave out to skip the "Is the court booked?" question, e.g. for a match already played */
  onBookedChange?: (isBooked: boolean) => void;
  club?: DropdownOption;
  onClubChange: (club: DropdownOption | undefined) => void;
  court?: DropdownOption;
  onCourtChange: (court: DropdownOption | undefined) => void;
};

/**
 * "Is the court booked?" with the club and court dropdowns when it is (design: Create match
 * (sheet)). Picking another club clears the court. When it isn't booked, the caller shows its note.
 */
export function CourtFields({
  clubs,
  isBooked,
  onBookedChange,
  club,
  onClubChange,
  court,
  onCourtChange,
}: CourtFieldsProps) {
  const { t } = useTranslation();
  const selectedClub = clubs.find((item) => item.id === club?.value);
  const courtOptions: DropdownOption[] = (selectedClub?.courts ?? []).map((item) => ({
    value: item.id,
    label: String(item.number),
  }));

  return (
    <>
      {onBookedChange ? (
        <SheetField label={t("createMatch.courtBooked")}>
          <SegmentedControl
            value={isBooked ? "yes" : "no"}
            onChange={(value) => onBookedChange(value === "yes")}
            options={[
              { value: "yes", label: t("createMatch.yesBooked"), icon: Check },
              { value: "no", label: t("createMatch.notYet") },
            ]}
          />
        </SheetField>
      ) : null}

      {isBooked ? (
        <View className="flex-row gap-2.5">
          <SheetField label={t("createMatch.club")} className="flex-[2]">
            <Dropdown
              label={t("createMatch.club")}
              icon={MapPin}
              placeholder={t("createMatch.chooseClub")}
              options={clubs.map((item) => ({ value: item.id, label: item.name }))}
              value={club}
              onChange={(option) => {
                onClubChange(option);
                onCourtChange(undefined);
              }}
            />
          </SheetField>
          <SheetField label={t("createMatch.courtNumber")} className="flex-1">
            <Dropdown
              label={t("createMatch.courtNumberA11y")}
              placeholder="–"
              options={courtOptions}
              value={court}
              onChange={onCourtChange}
              isDisabled={!selectedClub}
            />
          </SheetField>
        </View>
      ) : null}
    </>
  );
}
