import { router, Stack } from "expo-router";
import { Button } from "heroui-native";
import { useEffect, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import Animated from "react-native-reanimated";

import {
  CommunityIllustration,
  FairPlayIllustration,
  FindPlayersIllustration,
  TrustedLevelIllustration,
} from "@/components/onboarding-illustrations";
import { Page } from "@/components/page";
import { SetupProgress } from "@/components/setup-progress";
import { stepEntering } from "@/lib/motion";

type OnboardingPage = {
  title: "onboarding.recordTitle" | "onboarding.trustTitle" | "onboarding.fairTitle" | "onboarding.circleTitle";
  description:
    | "onboarding.recordText"
    | "onboarding.trustText"
    | "onboarding.fairText"
    | "onboarding.circleText";
  Illustration: ComponentType;
};

const pages: OnboardingPage[] = [
  {
    title: "onboarding.recordTitle",
    description: "onboarding.recordText",
    Illustration: CommunityIllustration,
  },
  {
    title: "onboarding.trustTitle",
    description: "onboarding.trustText",
    Illustration: TrustedLevelIllustration,
  },
  {
    title: "onboarding.fairTitle",
    description: "onboarding.fairText",
    Illustration: FairPlayIllustration,
  },
  {
    title: "onboarding.circleTitle",
    description: "onboarding.circleText",
    Illustration: FindPlayersIllustration,
  },
];

// Skip still lands on the fair-play rules, which every player has to agree to
const FAIR_PLAY_PAGE = 2;
const LAST_PAGE = pages.length - 1;
// Keeps the text block the same height on every page, so the pictures line up
const TEXT_BLOCK_HEIGHT = 132;

/**
 * Onboarding after profile setup: four pages that swap in place, with the
 * header and progress bar staying put, like setup.
 */
export default function Onboarding() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const page = pages[index];

  function goTo(next: number) {
    setDirection(next > index ? "forward" : "back");
    setIndex(next);
  }

  function back() {
    if (index > 0) goTo(index - 1);
    else router.back();
  }

  function next() {
    if (index < LAST_PAGE) goTo(index + 1);
    // Nothing is saved yet; the API will remember that onboarding is done
    else router.replace("/");
  }

  // Android's back button steps back through the pages before leaving
  useEffect(() => {
    if (index === 0) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      goTo(index - 1);
      return true;
    });
    return () => subscription.remove();
  });

  const canSkip = index < FAIR_PLAY_PAGE;
  const nextLabel =
    index === FAIR_PLAY_PAGE
      ? t("onboarding.agree")
      : index === LAST_PAGE
        ? t("onboarding.letsPlay")
        : t("onboarding.next");

  return (
    <Page variant="auth">
      {/* The iOS swipe-back would leave onboarding from a later page, so only allow it on the first */}
      <Stack.Screen options={{ gestureEnabled: index === 0 }} />
      <Page.Header
        back={index > 0 || router.canGoBack() ? back : undefined}
        leading={<SetupProgress step={index + 1} total={pages.length} />}
      />

      <Page.Body scroll={false} className="pb-0">
        <Animated.View
          key={index}
          entering={stepEntering(direction)}
          className="flex-1 gap-[22px]"
        >
          <page.Illustration />
          <View style={{ height: TEXT_BLOCK_HEIGHT }}>
            <Page.Title description={t(page.description)}>{t(page.title)}</Page.Title>
          </View>
        </Animated.View>
      </Page.Body>

      <Page.Footer className="flex-row gap-2.5">
        {/* Skip takes a third of the row and Next two thirds, as in the design */}
        {canSkip ? (
          <View className="flex-1">
            <Button size="lg" variant="outline" onPress={() => goTo(FAIR_PLAY_PAGE)}>
              <Button.Label className="text-ink-2">{t("onboarding.skip")}</Button.Label>
            </Button>
          </View>
        ) : null}
        <View className="flex-[2]">
          <Button size="lg" onPress={next}>
            {nextLabel}
          </Button>
        </View>
      </Page.Footer>
    </Page>
  );
}
