import { router, useLocalSearchParams } from "expo-router";
import { Button, Spinner } from "heroui-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";

import { Page } from "@/components/page";
import { PlayerSheet } from "@/components/player-sheet";
import { ScannedPlayerSheet } from "@/components/scanned-player-sheet";
import { useMyAccount } from "@/hooks/useMyProfile";
import { usePlayerByCode } from "@/hooks/usePlayers";
import { errorMessage } from "@/lib/error-message";
import { codeFromLink, shareLinkFor } from "@/lib/share-link";

/**
 * A player's code opened as a link (padelna://u/<code>, from a phone camera or a message):
 * the same sheet as scanning it inside the app.
 */
export default function OpenedCode() {
  const { t } = useTranslation();
  const { code: param } = useLocalSearchParams<{ code: string }>();
  const code = codeFromLink(shareLinkFor(param ?? ""));
  const { data: me } = useMyAccount();
  const lookup = usePlayerByCode(code);
  // The sheet opens as soon as the player is found; "Full profile" swaps it for their profile
  const [step, setStep] = useState<"sheet" | "profile" | "closed">("sheet");

  const player = lookup.data ?? undefined;
  const isOwn = player !== undefined && player.id === me?.id;
  const isSheetOpen = step === "sheet" && player !== undefined && !isOwn;
  const isProfileOpen = step === "profile";

  function leave() {
    if (router.canGoBack()) router.back();
    else router.replace("/");
  }

  const problem = !code
    ? { title: t("scanCode.notPadelna"), text: t("scanCode.notPadelnaText") }
    : lookup.error
      ? { title: t("scanCode.failed"), text: errorMessage(lookup.error) }
      : lookup.data === null
        ? { title: t("scanCode.notFound"), text: t("scanCode.notFoundText") }
        : isOwn
          ? { title: t("scanCode.yourOwn"), text: t("scanCode.yourOwnText") }
          : undefined;

  return (
    <Page>
      <Page.Header back={leave} />
      <Page.Body scroll={false} className="items-center justify-center gap-3">
        {problem ? (
          <>
            <Text accessibilityRole="header" className="text-center font-black text-[20px] text-foreground">
              {problem.title}
            </Text>
            <Text className="text-center font-normal text-[15px] leading-[22px] text-muted">{problem.text}</Text>
            <Button variant="secondary" onPress={leave}>
              {t("common.back")}
            </Button>
          </>
        ) : lookup.isPending ? (
          <Spinner accessibilityLabel={t("shareProfile.tabScan")} />
        ) : null}
      </Page.Body>

      <ScannedPlayerSheet
        player={player}
        isOpen={isSheetOpen}
        onOpenChange={(open) => {
          if (open) return;
          setStep("closed");
          leave();
        }}
        onFullProfile={() => setStep("profile")}
      />
      <PlayerSheet
        player={player}
        isOpen={isProfileOpen}
        onOpenChange={(open) => {
          if (open) return;
          setStep("closed");
          leave();
        }}
      />
    </Page>
  );
}
