import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";

import { SaveScoreSheet } from "@/components/save-score-sheet";
import { useMatch, usePendingScores } from "@/hooks/useMatches";
import { useMyAccount } from "@/hooks/useMyProfile";

const REMINDED_KEY = "padelna.score-reminded";
// Let Home settle after the splash screen before the sheet slides up
const OPEN_DELAY_MS = 800;

/**
 * Opens "Match finished!" once, the first time the app starts after a match you host is over
 * without a score. Later, the banner on Matches is the reminder.
 */
export function ScoreReminder() {
  const { data: account } = useMyAccount();
  const { data: pending } = usePendingScores();
  // Matches already shown to this player on this device; unknown until it's read
  const [reminded, setReminded] = useState<string[]>();
  const [matchId, setMatchId] = useState<string>();
  const [isOpen, setIsOpen] = useState(false);
  const hasOpened = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(REMINDED_KEY)
      .then((value) => setReminded(value ? (JSON.parse(value) as string[]) : []))
      .catch(() => setReminded([]));
  }, []);

  const due = reminded
    ? pending?.find((review) => review.action === "add" && !reminded.includes(review.matchId))
    : undefined;
  if (due && matchId === undefined) setMatchId(due.matchId);

  const { data: match } = useMatch(matchId ?? "", matchId !== undefined);
  const isReady = match != null && account !== undefined;

  useEffect(() => {
    if (!isReady || hasOpened.current || matchId === undefined) return;
    const timer = setTimeout(() => {
      hasOpened.current = true;
      setIsOpen(true);
      // Remembered as soon as it shows, so swiping it away doesn't bring it back next launch
      const next = [...(reminded ?? []), matchId];
      setReminded(next);
      AsyncStorage.setItem(REMINDED_KEY, JSON.stringify(next)).catch(() => {});
    }, OPEN_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isReady, matchId, reminded]);

  if (!match || !account) return null;
  return (
    <SaveScoreSheet
      match={match}
      myId={account.id}
      mode="add"
      isOpen={isOpen}
      onOpenChange={setIsOpen}
    />
  );
}
