import { router, useLocalSearchParams } from "expo-router";
import { Button, cn, PressableFeedback, Spinner, useToast } from "heroui-native";
import { Check, ChevronDown, Clock, Users } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { Icon } from "@/components/icon";
import { InfoNote } from "@/components/info-note";
import { Page } from "@/components/page";
import { PlayerAvatar, shortNameOf } from "@/components/player-avatar";
import { RatingScale } from "@/components/rating-scale";
import { useMatch, useSubmitRatings } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";
import { formatMatchDay } from "@/lib/format-date";
import { formatSets, teamOf } from "@/lib/padel-score";
import { isRatingOpen, playersToRate, type RatingValue } from "@/lib/player-rating";
import type { Player } from "@/types/player";

/**
 * "How did they play?" (design: Post-match review · v2 five-point scale). Once a score is in,
 * each player rates the others against their profile level. Opponents are open and required;
 * the partner is folded away and optional. Ratings are anonymous and only count in
 * competitive matches.
 */
export default function RatePlayers() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: match, isPending, isFetching } = useMatch(id);
  const { data: account } = useMyAccount();
  const submitRatings = useSubmitRatings();
  const [ratings, setRatings] = useState<Record<string, RatingValue>>({});
  const [isPartnerOpen, setIsPartnerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Kept after a successful send so the screen doesn't flip to "You rated this match" on its way out
  const [isSent, setIsSent] = useState(false);

  // Right after a score is saved the cached match has none yet, so wait for the fresh one
  const isOpen = isSent || (match != null && account != null && isRatingOpen(match, account.id));
  if (isPending || !account || (!isOpen && isFetching)) {
    return (
      <Page>
        <Page.Header back />
        <Page.Body scroll={false} className="items-center justify-center">
          <Spinner accessibilityLabel={t("rating.loading")} />
        </Page.Body>
      </Page>
    );
  }

  const myId = account.id;
  const myTeam = match ? teamOf(match, myId) : undefined;
  const players = match ? playersToRate(match, myId) : [];
  const opponents = players.filter((item) => !item.isPartner).map((item) => item.player);
  const partner = players.find((item) => item.isPartner)?.player;
  const isCompetitive = match?.kind === "competitive";
  const hasRated = match?.ratedBy?.includes(myId) ?? false;
  const subtitle = match?.score
    ? [formatMatchDay(match.startsAt), formatSets(match.score.sets, myTeam ?? 1)].join(" · ")
    : undefined;

  const header = (
    <Page.Header
      back
      leading={
        <View>
          <Text accessibilityRole="header" className="font-black text-[22px] tracking-[-0.3px] text-foreground">
            {t("rating.title")}
          </Text>
          {subtitle ? <Text className="font-normal text-[13px] text-muted">{subtitle}</Text> : null}
        </View>
      }
    />
  );

  // Already rated, too late, or nothing to rate: say why instead of showing the form
  if (!match || !isOpen || players.length === 0) {
    const note = hasRated
      ? { icon: Check, title: t("rating.doneTitle"), text: t("rating.doneText") }
      : players.length === 0 && match
        ? { icon: Users, title: t("rating.nobodyTitle"), text: t("rating.nobodyText") }
        : { icon: Clock, title: t("rating.closedTitle"), text: t("rating.closedText") };
    return (
      <Page>
        {header}
        <Page.Body>
          <InfoNote icon={note.icon} title={note.title}>
            {note.text}
          </InfoNote>
        </Page.Body>
      </Page>
    );
  }

  const missing = opponents.filter((player) => ratings[player.id] === undefined);

  function rate(player: Player, value: RatingValue) {
    setRatings((current) => ({ ...current, [player.id]: value }));
  }

  async function send() {
    setSubmitted(true);
    if (missing.length > 0) return;
    try {
      await submitRatings.mutateAsync({
        matchId: id,
        ratings: Object.entries(ratings).map(([playerId, rating]) => ({ playerId, rating })),
      });
    } catch (error) {
      toast.show({ variant: "danger", label: t("rating.failed"), description: (error as Error).message });
      return;
    }
    setIsSent(true);
    toast.show({
      variant: "success",
      label: t("rating.sent"),
      description: t(isCompetitive ? "rating.sentCompetitive" : "rating.sentFriendly"),
    });
    router.back();
  }

  return (
    <Page>
      {header}

      <Page.Body className="gap-4">
        <Text className="font-normal text-[15px] leading-[22px] text-ink-2">{t("rating.intro")}</Text>

        {opponents.map((player) => (
          <PlayerRatingCard
            key={player.id}
            player={player}
            role="opponent"
            value={ratings[player.id]}
            onChange={(value) => rate(player, value)}
            error={submitted && ratings[player.id] === undefined}
          />
        ))}

        {partner ? (
          isPartnerOpen ? (
            <PlayerRatingCard
              player={partner}
              role="partner"
              value={ratings[partner.id]}
              onChange={(value) => rate(partner, value)}
            />
          ) : (
            <PressableFeedback
              onPress={() => setIsPartnerOpen(true)}
              accessibilityRole="button"
              accessibilityHint={t("rating.howPlayed", { name: partner.firstName })}
              className="flex-row items-center gap-2.5 rounded-[18px] border border-line bg-surface px-3.5 py-3"
            >
              <PlayerAvatar player={partner} size={32} />
              <Text numberOfLines={1} className="flex-1 font-bold text-[15px] text-foreground">
                {shortNameOf(partner)}{" "}
                <Text className="font-medium text-muted">{t("rating.partner")}</Text>
              </Text>
              <Icon as={ChevronDown} size={18} color="muted" />
            </PressableFeedback>
          )
        ) : null}
      </Page.Body>

      <Page.Footer className="gap-2.5">
        <Text className="text-center font-normal text-[12px] leading-[17px] text-muted">
          {t(isCompetitive ? "rating.noteCompetitive" : "rating.noteFriendly")}
        </Text>
        <Button size="lg" onPress={send} isDisabled={submitRatings.isPending}>
          {t("rating.submit")}
        </Button>
      </Page.Footer>
    </Page>
  );
}

type PlayerRatingCardProps = {
  player: Player;
  role: "opponent" | "partner";
  value?: RatingValue;
  onChange: (value: RatingValue) => void;
  /** Shown after Submit when this player still has no rating */
  error?: boolean;
};

/** One player with the five-point scale under them. */
function PlayerRatingCard({ player, role, value, onChange, error }: PlayerRatingCardProps) {
  const { t } = useTranslation();
  const level = player.level?.toFixed(1);
  const meta =
    role === "opponent"
      ? level ? t("rating.opponent", { level }) : t("rating.opponentNoLevel")
      : level ? t("rating.partnerLevel", { level }) : t("rating.partnerNoLevel");

  return (
    <View
      className={cn(
        "gap-3 rounded-[20px] bg-surface p-3.5",
        error ? "border-2 border-danger" : "border border-line",
      )}
    >
      <View className="flex-row items-center gap-2.5">
        <PlayerAvatar player={player} size={40} />
        <View className="flex-1">
          <Text numberOfLines={1} className="font-bold text-[15px] text-foreground">
            {shortNameOf(player)}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
            {meta}
          </Text>
        </View>
      </View>
      <RatingScale
        value={value}
        onChange={onChange}
        accessibilityLabel={t("rating.howPlayed", { name: player.firstName })}
      />
      {error ? (
        <Text accessibilityRole="alert" className="font-semibold text-[13px] text-danger">
          {t("rating.pickError", { name: player.firstName })}
        </Text>
      ) : null}
    </View>
  );
}
