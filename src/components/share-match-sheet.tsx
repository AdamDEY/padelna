import { BottomSheet, cn, PressableFeedback, useToast } from "heroui-native";
import { CalendarDays, ChevronRight, Plus } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { PlayerAvatar, stackTintIndices } from "@/components/player-avatar";
import { formatMatchDay } from "@/lib/format-date";
import type { ShareableMatch } from "@/types/match";

const missingCopy = {
  score: { status: "shareMatch.noScore", action: "shareMatch.addScore" },
  photo: { status: "shareMatch.noPhoto", action: "shareMatch.addPhoto" },
} as const;

type ShareMatchSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Recent matches played through the app that can still be posted */
  matches: ShareableMatch[];
};

/** "Share a match" menu from the Community + button: post a recent match or log one played elsewhere. */
export function ShareMatchSheet({ isOpen, onOpenChange, matches }: ShareMatchSheetProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  // The score, photo and log-a-match screens aren't built yet
  function comingSoon(label: string) {
    onOpenChange(false);
    toast.show({ label, description: t("myMatch.comingSoon") });
  }

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          <View className="flex-row items-center justify-between gap-3">
            <BottomSheet.Title className="font-black text-[24px] tracking-[-0.4px] text-foreground">
              {t("shareMatch.title")}
            </BottomSheet.Title>
            <BottomSheet.Close className="size-10 rounded-full bg-fill" />
          </View>

          <View className="gap-2.5">
            <OptionHeader
              icon={<Icon as={CalendarDays} size={22} color="accent" />}
              iconClassName="bg-primary-soft"
              title={t("shareMatch.postRecent")}
              description={t("shareMatch.postRecentText")}
            />
            {matches.map((match) => (
              <RecentMatchRow
                key={match.id}
                match={match}
                onPress={() =>
                  comingSoon(
                    match.missing === "score" ? t("shareMatch.addingScore") : t("shareMatch.addingPhoto"),
                  )
                }
              />
            ))}
          </View>

          <View className="h-px bg-line" />

          <PressableFeedback
            onPress={() => comingSoon(t("shareMatch.logging"))}
            accessibilityRole="button"
            accessibilityHint={t("shareMatch.logElsewhereText")}
          >
            <View className="flex-row items-center gap-3">
              <OptionHeader
                icon={<Icon as={Plus} size={22} color="lime-foreground" />}
                iconClassName="bg-court-lime"
                title={t("shareMatch.logElsewhere")}
                description={t("shareMatch.logElsewhereText")}
              />
              <Icon as={ChevronRight} size={20} color="muted" />
            </View>
          </PressableFeedback>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function OptionHeader({
  icon,
  iconClassName,
  title,
  description,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
}) {
  return (
    <View className="flex-1 flex-row items-center gap-3">
      <View className={cn("size-11 items-center justify-center rounded-[14px]", iconClassName)}>
        {icon}
      </View>
      <View className="flex-1">
        <Text className="font-bold text-[16px] text-foreground">{title}</Text>
        <Text className="font-normal text-[13px] text-muted">{description}</Text>
      </View>
    </View>
  );
}

function RecentMatchRow({ match, onPress }: { match: ShareableMatch; onPress: () => void }) {
  const { t } = useTranslation();
  const copy = {
    status: t(missingCopy[match.missing].status),
    action: t(missingCopy[match.missing].action),
  };
  const tintIndices = stackTintIndices(match.players);
  const title = `${formatMatchDay(match.playedAt)} · ${match.clubName}`;

  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${copy.status}. ${copy.action}`}
      className="flex-row items-center gap-3 rounded-2xl border border-line p-3"
    >
      <View className="flex-row">
        {match.players.map((player, index) => (
          <PlayerAvatar
            key={player.id}
            player={player}
            size={26}
            tintIndex={tintIndices[index]}
            ringClassName="border-surface"
            className={index > 0 ? "-ms-2" : undefined}
          />
        ))}
      </View>
      <View className="min-w-0 flex-1">
        <Text numberOfLines={2} className="font-bold text-[14px] text-foreground">
          {title}
        </Text>
        <Text className="font-normal text-[12px] text-muted">{copy.status}</Text>
      </View>
      <Text className="font-bold text-[13px] text-accent">{copy.action}</Text>
    </PressableFeedback>
  );
}
