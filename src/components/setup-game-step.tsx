import { cn } from "heroui-native";
import { Scale, Shield, Target, Zap, type LucideIcon } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { OptionTile } from "@/components/option-tile";
import { Page } from "@/components/page";
import { SegmentedControl } from "@/components/segmented-control";

type Hand = "right" | "left";
type Side = "left" | "right" | "both";
type PlayStyle = "aggressive" | "balanced" | "defensive" | "tactical";

export type GameValues = { hand: Hand; side: Side; playStyle: PlayStyle };

// Preselected like the design; most players are right-handed
export const initialGameValues: GameValues = { hand: "right", side: "right", playStyle: "balanced" };

const handOptions: { value: Hand; label: string }[] = [
  { value: "right", label: "Right hand" },
  { value: "left", label: "Left hand" },
];

const sideOptions: { value: Side; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
  { value: "both", label: "Both" },
];

const playStyles: { value: PlayStyle; label: string; icon: LucideIcon; description: string }[] = [
  {
    value: "aggressive",
    label: "Aggressive",
    icon: Zap,
    description: "you go to the net and finish points fast.",
  },
  {
    value: "balanced",
    label: "Balanced",
    icon: Scale,
    description: "a bit of everything, comfortable anywhere on court.",
  },
  {
    value: "defensive",
    label: "Defensive",
    icon: Shield,
    description: "you love long rallies and get every ball back.",
  },
  {
    value: "tactical",
    label: "Tactical",
    icon: Target,
    description: "you build points with placement and patience.",
  },
];

type SetupGameStepProps = {
  values: GameValues;
  onChange: (values: GameValues) => void;
};

/** Profile setup step 2, "Your game": hand, preferred side and play style. */
export function SetupGameStep({ values, onChange }: SetupGameStepProps) {
  const style = playStyles.find((item) => item.value === values.playStyle)!;

  return (
    <>
      <Page.Title description="Helps us pair you with the right partner.">Your game</Page.Title>

      <View className="gap-2.5">
        <Text className="font-bold text-[15px] text-foreground">I play with my</Text>
        <SegmentedControl
          options={handOptions}
          value={values.hand}
          onChange={(hand) => onChange({ ...values, hand })}
        />
      </View>

      <View className="gap-2.5">
        <Text className="font-bold text-[15px] text-foreground">Preferred side</Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2.5">
          {sideOptions.map((option) => (
            <OptionTile
              key={option.value}
              label={option.label}
              isSelected={values.side === option.value}
              onPress={() => onChange({ ...values, side: option.value })}
              renderIcon={(isSelected) => <SideDiagram side={option.value} isSelected={isSelected} />}
            />
          ))}
        </View>
      </View>

      <View className="gap-2.5">
        <Text className="font-bold text-[15px] text-foreground">Your play style</Text>
        <View accessibilityRole="radiogroup" className="flex-row gap-2">
          {playStyles.map((option) => (
            <OptionTile
              key={option.value}
              label={option.label}
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
          <Text className="font-bold text-foreground">{style.label}:</Text> {style.description}
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
