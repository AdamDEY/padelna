import { BottomSheet, Button } from "heroui-native";
import { Check, ScanLine } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { ConnectButton } from "@/components/connect-button";
import { Icon } from "@/components/icon";
import { PlayerAvatar, shortNameOf, stackTintIndices } from "@/components/player-avatar";
import { useMyAccount } from "@/hooks/useMyProfile";
import { STATS_MIN_MATCHES } from "@/lib/profile-stats";
import type { ScannedPlayer } from "@/types/player";

// A level this close counts as "the same level"; twice that is still a good partner
const SAME_LEVEL = 0.25;
const GOOD_PARTNER_LEVEL = 0.5;

const sideKeys = {
  left: "side.leftSide",
  right: "side.rightSide",
  both: "playerSheet.bothSides",
} as const;

type ScannedPlayerSheetProps = {
  /** The player whose code was scanned; keep passing the last one while the sheet closes */
  player: ScannedPlayer | undefined;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** "Full profile": the caller closes this sheet and opens the player's profile */
  onFullProfile: (player: ScannedPlayer) => void;
};

/** What you see after scanning a code (design: "Share profile · scanned, connect"): the player and a Connect button. */
export function ScannedPlayerSheet({ player, isOpen, onOpenChange, onFullProfile }: ScannedPlayerSheetProps) {
  const { data: me } = useMyAccount();

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal disableFullWindowOverlay>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          contentContainerClassName="gap-4 px-5 pb-[34px] pt-1"
          handleIndicatorClassName="h-[5px] w-10 bg-line-input"
        >
          {player ? <Content player={player} myLevel={me?.level} onFullProfile={onFullProfile} /> : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

function Content({
  player,
  myLevel,
  onFullProfile,
}: {
  player: ScannedPlayer;
  myLevel: number | undefined;
  onFullProfile: (player: ScannedPlayer) => void;
}) {
  const { t } = useTranslation();
  const hasWinRate = player.matchesScored >= STATS_MIN_MATCHES;
  const stats = [
    { value: String(player.matchesPlayed), label: t("scannedPlayer.matches") },
    {
      value: hasWinRate ? `${Math.round((player.wins / player.matchesScored) * 100)}%` : "–",
      label: t("scannedPlayer.wins"),
    },
    { value: String(player.friendCount), label: t("scannedPlayer.friends") },
    { value: String(player.mutualFriendCount ?? 0), label: t("scannedPlayer.mutual") },
  ];
  const levelGap = myLevel !== undefined && player.level !== undefined ? Math.abs(player.level - myLevel) : undefined;
  const fitKey =
    levelGap === undefined
      ? undefined
      : levelGap <= SAME_LEVEL
        ? "scannedPlayer.sameLevel"
        : levelGap <= GOOD_PARTNER_LEVEL
          ? "scannedPlayer.closeLevel"
          : undefined;
  const mutualTints = stackTintIndices(player.mutualFriends);
  const mutualNames = player.mutualFriends.map(shortNameOf);

  return (
    <>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5 rounded-[10px] bg-success-soft px-2.5 py-1">
          <Icon as={ScanLine} size={14} color="success" />
          <Text className="font-bold text-[12px] text-success">{t("scannedPlayer.badge")}</Text>
        </View>
        <BottomSheet.Close className="size-9 rounded-full bg-background" accessibilityLabel={t("scannedPlayer.close")} />
      </View>

      <View className="flex-row items-center gap-3.5">
        <PlayerAvatar player={player} size={72} />
        <View className="flex-1 gap-1.5">
          <BottomSheet.Title numberOfLines={1} className="font-black text-[22px] text-foreground">
            {player.firstName} {player.lastName}
          </BottomSheet.Title>
          <View className="flex-row gap-1.5">
            {player.level !== undefined ? (
              <Text className="overflow-hidden rounded-[10px] bg-lime-soft px-2.5 py-1 font-bold text-[12px] text-lime-foreground">
                {t("shareProfile.level", { level: player.level.toFixed(1) })}
              </Text>
            ) : null}
            {player.city ? (
              <Text className="overflow-hidden rounded-[10px] bg-out-of-range px-2.5 py-1 font-bold text-[12px] text-ink-2">
                {player.city}
              </Text>
            ) : null}
          </View>
          <Text className="font-normal text-[13px] text-muted">
            {t("scannedPlayer.sideLine", {
              side: t(sideKeys[player.side]),
              style: t(`playStyle.${player.playStyle}`),
            })}
          </Text>
        </View>
      </View>

      <View className="flex-row rounded-2xl bg-background px-1 py-2.5">
        {stats.map((stat) => (
          <View key={stat.label} accessible accessibilityLabel={`${stat.value} ${stat.label}`} className="flex-1 items-center">
            <Text className="font-black text-[18px] text-foreground">{stat.value}</Text>
            <Text className="font-bold text-[11px] text-muted">{stat.label}</Text>
          </View>
        ))}
      </View>

      {mutualNames.length > 0 ? (
        <View className="flex-row items-center gap-2.5 rounded-[14px] bg-primary-soft px-3 py-2.5">
          <View className="flex-row">
            {player.mutualFriends.map((friend, index) => (
              <View key={friend.id} className={index > 0 ? "-ms-2" : undefined}>
                <PlayerAvatar player={friend} size={28} tintIndex={mutualTints[index]} ringClassName="border-primary-soft" />
              </View>
            ))}
          </View>
          <Text className="flex-1 font-bold text-[13px] text-primary-dark">
            {t("scannedPlayer.friendsWith", {
              count: mutualNames.length,
              names: mutualNames.length === 2 ? t("scannedPlayer.and", { first: mutualNames[0], second: mutualNames[1] }) : mutualNames[0],
            })}
          </Text>
        </View>
      ) : null}

      {fitKey ? (
        <View className="flex-row items-center gap-2 rounded-[14px] bg-success-soft px-3 py-2.5">
          <Icon as={Check} size={18} color="success" />
          <Text className="flex-1 font-bold text-[14px] text-success">{t(fitKey)}</Text>
        </View>
      ) : null}

      <View className="flex-row gap-2.5">
        <Button variant="outline" onPress={() => onFullProfile(player)} className="h-[52px] flex-1 rounded-2xl border-line-input bg-surface">
          <Button.Label className="text-[16px] text-foreground">{t("scannedPlayer.fullProfile")}</Button.Label>
        </Button>
        <View className="flex-[1.4]">
          <ConnectButton player={player} size="lg" />
        </View>
      </View>

      {player.connection !== "connected" ? (
        <Text className="-mt-1.5 text-center font-normal text-[12px] text-muted">
          {t("scannedPlayer.note", { name: player.firstName })}
        </Text>
      ) : null}
    </>
  );
}
