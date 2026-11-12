import { Button, PressableFeedback, useToast } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { PlayerAvatar } from "@/components/player-avatar";
import { useRespondToMatchInvite } from "@/hooks/useMatchInvites";
import { celebrate } from "@/lib/celebrate";
import { errorMessage } from "@/lib/error-message";
import { formatMatchDateTime } from "@/lib/format-date";
import type { MyMatchInvite } from "@/types/match";

type MatchInviteCardProps = {
  invite: MyMatchInvite;
  /** Opens the match */
  onPress: () => void;
};

/**
 * An invitation from a host, waiting for your answer: who invited you, when and where, with
 * Accept (you take the held spot) and Decline.
 */
export function MatchInviteCard({ invite, onPress }: MatchInviteCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const respond = useRespondToMatchInvite();
  const { host } = invite;
  const where = [invite.clubName ?? t("match.courtNotBooked"), invite.courtName].filter(Boolean).join(" · ");
  const details = [
    t(invite.kind === "competitive" ? "match.kind.competitive" : "match.kind.friendly"),
    t("matchInvite.level", { min: invite.levelMin.toFixed(1), max: invite.levelMax.toFixed(1) }),
  ].join(" · ");

  function answer(accept: boolean) {
    respond.mutate(
      { inviteId: invite.id, matchId: invite.matchId, accept },
      {
        onSuccess: () => {
          if (accept) {
            toast.show({
              variant: "success",
              label: t("matchDetail.youAreIn"),
              description: t("matchDetail.joinedText", {
                title: formatMatchDateTime(invite.startsAt),
                club: invite.clubName ?? t("matchDetail.courtToBook"),
              }),
            });
            celebrate();
          } else {
            toast.show({ label: t("matchInvite.declined"), description: t("matchInvite.declinedText") });
          }
        },
        onError: (error) =>
          toast.show({ variant: "danger", label: t("matchInvite.answerFailed"), description: errorMessage(error) }),
      },
    );
  }

  return (
    <View className="gap-3 rounded-[20px] border border-line bg-surface p-3.5">
      <PressableFeedback
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${t("matchInvite.invitedYou", { name: host.firstName })}, ${formatMatchDateTime(invite.startsAt)}, ${where}`}
        className="flex-row items-center gap-3"
      >
        <PlayerAvatar player={host} size={44} />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text numberOfLines={1} className="font-black text-[15px] text-foreground">
            {t("matchInvite.invitedYou", { name: host.firstName })}
          </Text>
          <Text numberOfLines={1} className="font-bold text-[14px] text-accent-text">
            {formatMatchDateTime(invite.startsAt)}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
            {where}
          </Text>
          <Text numberOfLines={1} className="font-normal text-[13px] text-muted">
            {details}
          </Text>
        </View>
      </PressableFeedback>
      <View className="flex-row gap-2">
        <Button
          size="sm"
          onPress={() => answer(true)}
          isDisabled={respond.isPending}
          accessibilityLabel={t("matchInvite.acceptA11y", { name: host.firstName })}
          className="h-11 flex-1 rounded-[14px]"
        >
          <Button.Label className="font-bold text-[14px]">{t("matchInvite.acceptShort")}</Button.Label>
        </Button>
        <Button
          size="sm"
          variant="outline"
          onPress={() => answer(false)}
          isDisabled={respond.isPending}
          accessibilityLabel={t("matchInvite.declineA11y", { name: host.firstName })}
          className="h-11 flex-1 rounded-[14px] border-line-input bg-surface"
        >
          <Button.Label className="font-bold text-[14px] text-ink-2">{t("matchInvite.decline")}</Button.Label>
        </Button>
      </View>
    </View>
  );
}
