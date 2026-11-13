import { cn, PressableFeedback } from "heroui-native";
import { Check, Info, Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { InfoNote } from "@/components/info-note";
import { SegmentedControl } from "@/components/segmented-control";
import { SELF_LEVEL_OPTIONS } from "@/data/level-quiz";

type SetupLevelPickProps = {
  /** The level chosen so far; nothing is chosen until the player picks */
  value: number | undefined;
  onChange: (level: number) => void;
};

/** "1.0 – 1.5", or "6.0 – 7.0" for the top band that only a coach can set */
function rangeLabel(lower: number, upper: number, isLocked: boolean) {
  return `${lower.toFixed(1)} – ${isLocked ? "7.0" : upper.toFixed(1)}`;
}

/**
 * Profile setup after Skip: six cards, one per band, to choose a starting level from
 * (design artboard "Profile setup · Quiz skipped → pick your level"). The chosen card opens
 * to pick the lower or upper half of its band. Nothing is chosen at first, so the player
 * decides, and Expert is locked: that level has to be set by a coach.
 */
export function SetupLevelPick({ value, onChange }: SetupLevelPickProps) {
  const { t } = useTranslation();

  return (
    <>
      <View className="gap-1.5">
        <Text
          accessibilityRole="header"
          className="font-black text-[26px] leading-[31px] tracking-[-0.4px] text-foreground"
        >
          {t("setup.pick.title")}
        </Text>
        <Text className="font-normal text-[14px] leading-[20px] text-muted">{t("setup.pick.text")}</Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel={t("setup.pick.title")} className="gap-[7px]">
      {SELF_LEVEL_OPTIONS.map(({ band, lower, upper, isLocked }) => {
        const isSelected = value !== undefined && value >= lower && value < lower + 1;
        const half = value !== undefined && value >= upper ? "upper" : "lower";
        const name = t(`setup.result.bands.${band}`);

        return (
          <PressableFeedback
            key={band}
            // The half toggle inside a chosen card must not send a tap to the card, which would reset it
            onPress={() => !isSelected && onChange(lower)}
            isDisabled={isLocked}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled: isLocked }}
            accessibilityLabel={`${name}, ${rangeLabel(lower, upper, isLocked)}`}
            className={cn(
              "gap-2.5 rounded-2xl px-3.5",
              isSelected ? "border-2 border-accent bg-primary-soft py-3" : "border border-line-input bg-surface py-[9px]",
              isLocked && "opacity-60",
            )}
          >
            <View className="flex-row items-center gap-3">
              {isSelected ? (
                <View className="size-[22px] items-center justify-center rounded-full bg-accent">
                  <Icon as={Check} size={13} color="accent-foreground" />
                </View>
              ) : (
                <View className="size-[22px] rounded-full border-2 border-radio-border" />
              )}
              <View className="flex-1">
                <Text
                  className={cn(
                    "text-[15px]",
                    isSelected ? "font-bold text-primary-dark" : "font-bold text-foreground",
                  )}
                >
                  {name}
                </Text>
                <Text className={cn("text-[12px]", isSelected ? "text-primary-dark" : "text-muted")}>
                  {t(`setup.pick.${band}`)}
                  {isLocked ? ` · ${t("setup.pick.coachOnly")}` : ""}
                </Text>
              </View>
              {isLocked ? (
                <Icon as={Lock} size={16} color="muted" />
              ) : (
                <View className={cn("rounded-[9px] px-2 py-1", isSelected ? "bg-lime-soft" : "bg-fill")}>
                  <Text
                    className={cn(
                      "font-black text-[12px]",
                      isSelected ? "text-lime-foreground" : "text-ink-2",
                    )}
                  >
                    {rangeLabel(lower, upper, isLocked)}
                  </Text>
                </View>
              )}
            </View>

            {isSelected ? (
              <SegmentedControl
                options={[
                  { value: "lower", label: t("setup.pick.lowerHalf", { level: lower.toFixed(1) }) },
                  { value: "upper", label: t("setup.pick.upperHalf", { level: upper.toFixed(1) }) },
                ]}
                value={half}
                onChange={(next) => onChange(next === "upper" ? upper : lower)}
              />
            ) : null}
          </PressableFeedback>
        );
      })}
      </View>

      <InfoNote icon={Info} tone="warning" title={t("setup.pick.noteTitle")}>
        {t("setup.pick.noteText")}
      </InfoNote>
    </>
  );
}
