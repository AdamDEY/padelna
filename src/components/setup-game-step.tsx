import { cn } from "heroui-native";
import { Scale, Shield, Target, Zap, type LucideIcon } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { OptionTile } from "@/components/option-tile";
import { Page } from "@/components/page";
import { SegmentedControl } from "@/components/segmented-control";

export type Hand = "right" | "left";
export type Side = "left" | "right" | "both";
export type PlayStyle = "aggressive" | "balanced" | "defensive" | "tactical";

export type GameValues = { hand: Hand; side: Side; playStyle: PlayStyle };

// Preselected like the design; most players are right-handed
export const initialGameValues: GameValues = { hand: "right", side: "right", playStyle: "balanced" };

const sideValues: Side[] = ["left", "right", "both"];
const sideLabelKeys = {
  left: "settings.handLeft",
  right: "settings.handRight",
  both: "settings.sideBoth",
} as const;

const playStyles: { value: PlayStyle; icon: LucideIcon }[] = [
  { value: "aggressive", icon: Zap },
  { value: "balanced", icon: Scale },
  { value: "defensive", icon: Shield },
  { value: "tactical", icon: Target },
];

type SetupGameStepProps = {
  values: GameValues;
  onChange: (values: GameValues) => void;
};

/** Profile setup step 2, "Your game": hand, preferred side and play style. */
export function SetupGameStep({ values, onChange }: SetupGameStepProps) {
  const { t } = useTranslation();
  const handOptions: { value: Hand; label: string }[] = [
    { value: "right", label: t("setup.rightHand") },
    { value: "left", label: t("setup.leftHand") },
  ];
  const styleLabel = t(`playStyle.${values.playStyle}`);

  return (
    <>
      <Page.Title description={t("setup.gameText")}>{t("setup.gameTitle")}</Page.Title>

      <View className="gap-2.5">
        <Text className="font-bold text-[15px] text-foreground">{t("setup.playWith")}</Text>
        <SegmentedControl
          options={handOptions}
          value={values.hand}
          onChange={(hand) => onChange({ ...values, hand })}
        />
      </View>

      <View className="gap-2.5">
        <Text className="font-bold text-[15px] text-foreground">{t("settings.preferredSide")}</Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2.5">
          {sideValues.map((side) => (
            <OptionTile
              key={side}
              label={t(sideLabelKeys[side])}
              isSelected={values.side === side}
              onPress={() => onChange({ ...values, side })}
              renderIcon={(isSelected) => <SideDiagram side={side} isSelected={isSelected} />}
            />
          ))}
        </View>
      </View>

      <View className="gap-2.5">
        <Text className="font-bold text-[15px] text-foreground">{t("setup.yourPlayStyle")}</Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {playStyles.map((option) => (
            <OptionTile
              key={option.value}
              label={t(`playStyle.${option.value}`)}
              compact
              isSelected={values.playStyle === option.value}
              onPress={() => onChange({ ...values, playStyle: option.value })}
              renderIcon={(isSelected) => (
                <View
                  className={cn(
                    "size-8 items-center justify-center rounded-[10px]",
                    isSelected ? "bg-accent" : "bg-fill",
                  )}
                >
                  <Icon
                    as={option.icon}
                    size={18}
                    color={isSelected ? "accent-foreground" : "accent"}
                  />
                </View>
              )}
            />
          ))}
        </View>
        <Text className="font-normal text-[13px] leading-[18px] text-muted">
          <Text className="font-bold text-foreground">{styleLabel}:</Text>{" "}
          {t(`setup.desc.${values.playStyle}`)}
        </Text>
      </View>
    </>
  );
}

/** Small court seen from above, with the chosen half filled in. */
function SideDiagram({ side, isSelected }: { side: Side; isSelected: boolean }) {
  const fill = isSelected ? "bg-accent" : "bg-line-input";

  return (
    <View
      className={cn(
        "h-6 w-[34px] flex-row overflow-hidden rounded-[3px] border-2",
        isSelected ? "border-accent" : "border-diagram-line",
        side === "both" && fill,
      )}
    >
      <View className={cn("flex-1", side === "left" && fill)} />
      <View className={cn("flex-1", side === "right" && fill)} />
    </View>
  );
}
