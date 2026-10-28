import { router } from "expo-router";
import { Button, PressableFeedback, useToast } from "heroui-native";
import { CalendarDays, Check, Clock, MapPin, MessageSquare } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { MatchLineUp } from "@/components/match-line-up";
import { Page } from "@/components/page";
import { SettingsRow, SettingsSection } from "@/components/settings-section";
import { useCancelMatch } from "@/hooks/useMatches";
import { formatMatchDay, formatStartsIn } from "@/lib/format-date";
import type { MatchDetails } from "@/types/match";
import type { LucideIcon } from "lucide-react-native";

// The countdown shows minutes at its finest, so refresh it once a minute
const COUNTDOWN_REFRESH_MS = 60_000;

function formatTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

type HostedMatchProps = {
  match: MatchDetails;
};

/** Match detail for the host (design: Your match · hosting): countdown, line-up and host tools. */
export function HostedMatch({ match }: HostedMatchProps) {
  const { toast } = useToast();
  const cancelMatch = useCancelMatch();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), COUNTDOWN_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  const start = formatTime(match.startsAt);
  const end = formatTime(new Date(match.startsAt.getTime() + match.durationMinutes * 60_000));
  const place = match.isCourtBooked
    ? [match.clubName, match.courtName].filter(Boolean).join(" · ")
    : "Court not booked yet";
  const details = [
    place,
    match.kind === "competitive" ? "Competitive" : "Friendly",
    match.levelMin !== undefined && match.levelMax !== undefined
      ? `${match.levelMin.toFixed(1)} – ${match.levelMax.toFixed(1)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // These need chat, maps and calendar support, or the player-management API
  function comingSoon(label: string) {
    toast.show({ label, description: "This is coming soon." });
  }

  function confirmCancel() {
    Alert.alert("Cancel this match?", "It will be removed for everyone in the line-up.", [
      { text: "Keep match", style: "cancel" },
      {
        text: "Cancel match",
        style: "destructive",
        onPress: () =>
          cancelMatch.mutate(match.id, {
            onSuccess: () => {
              toast.show({ label: "Match cancelled" });
              router.back();
            },
            onError: (error) =>
              toast.show({
                variant: "danger",
                label: "Couldn’t cancel the match",
                description: error.message,
              }),
          }),
      },
    ]);
  }

  return (
    <Page>
      <Page.Header
        back
        leading={
          <Text
            accessibilityRole="header"
            className="font-black text-[22px] tracking-[-0.3px] text-foreground"
          >
            Your match
          </Text>
        }
      >
        <Text className="self-center overflow-hidden rounded-xl bg-accent px-3 py-1.5 font-bold text-[12px] text-accent-foreground">
          Hosting
        </Text>
      </Page.Header>

      <Page.Body className="gap-4">
        <View className="gap-3 rounded-[24px] bg-accent p-[18px]">
          <View className="flex-row items-center justify-between">
            <Text className="font-bold text-[12px] uppercase tracking-[0.8px] text-primary-tint-text">
              Starts in
            </Text>
            <View className="flex-row items-center gap-1 rounded-[10px] bg-lime px-2.5 py-1">
              <Icon as={match.isCourtBooked ? Check : Clock} size={12} color="lime-foreground" />
              <Text className="font-bold text-[12px] text-lime-foreground">
                {match.isCourtBooked ? "Court booked" : "Not booked yet"}
              </Text>
            </View>
          </View>
          <Text className="font-black text-[32px] leading-[32px] tracking-[-0.8px] text-accent-foreground">
            {formatStartsIn(match.startsAt, now)}
          </Text>
          <View className="gap-0.5">
            <Text className="font-bold text-[16px] text-accent-foreground">
              {formatMatchDay(match.startsAt)} · {start} – {end}
            </Text>
            <Text className="font-normal text-[14px] text-primary-tint-text">{details}</Text>
          </View>
        </View>

        <View className="flex-row gap-2.5">
          <ActionTile icon={MapPin} label="Directions" onPress={() => comingSoon("Directions")} />
          <ActionTile icon={CalendarDays} label="Calendar" onPress={() => comingSoon("Calendar")} />
          <ActionTile
            icon={MessageSquare}
            label="Group chat"
            onPress={() => comingSoon("Group chat")}
          />
        </View>

        <View className="gap-3 rounded-[20px] border border-line bg-surface p-3.5">
          <View className="flex-row items-baseline justify-between">
            <Text accessibilityRole="header" className="font-black text-[15px] text-foreground">
              Line-up · {match.players.length}/{match.capacity}
            </Text>
            <PressableFeedback
              onPress={() => comingSoon("Swapping teams")}
              accessibilityRole="button"
              hitSlop={8}
            >
              <Text className="font-bold text-[13px] text-accent">Swap teams</Text>
            </PressableFeedback>
          </View>
          <MatchLineUp
            players={match.players}
            capacity={match.capacity}
            newPlayerIds={new Set()}
            openSeatLabel="Open"
          />
        </View>

        <SettingsSection title="Host tools">
          <SettingsRow
            label="Edit time, level or type"
            onPress={() => comingSoon("Editing your match")}
          />
          <SettingsRow
            label={match.courtName ? `Booking · ${match.courtName}` : "Booking"}
            value={match.isCourtBooked ? "Booked" : "Add court"}
            onPress={() => comingSoon("Booking")}
          />
          <SettingsRow
            label="Manage players"
            value="Remove · reopen spot"
            onPress={() => comingSoon("Managing players")}
          />
        </SettingsSection>
      </Page.Body>

      <Page.Footer>
        <Button
          size="lg"
          variant="outline"
          onPress={confirmCancel}
          isDisabled={cancelMatch.isPending}
          className="border-attention-outline bg-surface"
        >
          <Button.Label className="text-attention-action">Cancel match</Button.Label>
        </Button>
      </Page.Footer>
    </Page>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableFeedback
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-16 flex-1 items-center justify-center gap-1 rounded-2xl border border-line bg-surface"
    >
      <Icon as={icon} size={20} color="accent" />
      <Text className="font-bold text-[12px] text-foreground">{label}</Text>
    </PressableFeedback>
  );
}
