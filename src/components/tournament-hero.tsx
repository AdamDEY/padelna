import { Button, cn } from "heroui-native";
import { ChevronLeft, Trophy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";

const chipTones = {
  glass: { box: "bg-white/15", text: "text-accent-foreground" },
  lime: { box: "bg-lime-soft", text: "text-lime-foreground" },
  soft: { box: "bg-primary-soft", text: "text-primary-dark" },
} as const;

type TournamentHeroProps = {
  title: string;
  subtitle?: string;
  chips?: { label: string; tone: keyof typeof chipTones }[];
  /** The trophy line under the title: "1 title · La Marsa Summer Cup" */
  highlight?: { title: string; text: string };
  /** Numbers in the glass strip; `accent` paints one lime, like "Winner" */
  stats?: { value: string; label: string; accent?: boolean }[];
  onBack: () => void;
};

/**
 * Blue header of Tournament history and of both recaps: back button and title, optional chips and
 * trophy line, then a strip of numbers (design canvas "Tournament history · from profile").
 */
export function TournamentHero({ title, subtitle, chips, highlight, stats, onBack }: TournamentHeroProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <View className="gap-4 overflow-hidden rounded-b-[32px] bg-hero px-5 pb-5" style={{ paddingTop: insets.top + 8 }}>
      {/* Faint court lines in the corner */}
      <View
        aria-hidden
        className="absolute -end-[60px] h-[170px] w-[220px] rounded-lg border-2 border-white/10"
        style={{ top: insets.top + 30 }}
      />

      <View className="flex-row items-center gap-3">
        <Button
          variant="ghost"
          isIconOnly
          accessibilityLabel={t("common.back")}
          onPress={onBack}
          className="size-11 rounded-full bg-white/15"
        >
          <Icon as={ChevronLeft} size={22} color="accent-foreground" />
        </Button>
        <View className="min-w-0 flex-1">
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            className="font-black text-[22px] tracking-[-0.3px] text-accent-foreground"
          >
            {title}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} className="font-normal text-[13px] text-primary-tint-text">
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>

      {chips && chips.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {chips.map((chip) => (
            <View key={chip.label} className={cn("rounded-[10px] px-2.5 py-1", chipTones[chip.tone].box)}>
              <Text className={cn("font-bold text-[12px]", chipTones[chip.tone].text)}>{chip.label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {highlight ? (
        <View accessible className="flex-row items-center gap-3 rounded-[18px] bg-white/12 px-3.5 py-3">
          <View className="size-[42px] items-center justify-center rounded-[14px] bg-lime">
            <Icon as={Trophy} size={22} color="on-lime" />
          </View>
          <View className="min-w-0 flex-1">
            <Text numberOfLines={1} className="font-bold text-[15px] text-accent-foreground">
              {highlight.title}
            </Text>
            <Text numberOfLines={1} className="font-normal text-[12px] text-primary-tint-text">
              {highlight.text}
            </Text>
          </View>
        </View>
      ) : null}

      {stats && stats.length > 0 ? (
        <View className="flex-row rounded-[18px] bg-white/12 py-3">
          {stats.map((stat, index) => (
            <View
              key={stat.label}
              accessible
              accessibilityLabel={`${stat.value} ${stat.label}`}
              className={cn("flex-1 items-center px-1", index > 0 && "border-s border-white/20")}
            >
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                className={cn("font-black text-[20px]", stat.accent ? "text-lime" : "text-accent-foreground")}
              >
                {stat.value}
              </Text>
              <Text numberOfLines={1} className="font-normal text-[11px] text-primary-tint-text">
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
