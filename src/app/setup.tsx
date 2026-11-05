import { router, Stack } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import Animated from "react-native-reanimated";

import { Page } from "@/components/page";
import {
  initialAboutValues,
  isAboutComplete,
  SetupAboutStep,
} from "@/components/setup-about-step";
import { initialGameValues, SetupGameStep } from "@/components/setup-game-step";
import { SetupProgress } from "@/components/setup-progress";
import { SetupQuizStep } from "@/components/setup-quiz-step";
import { levelQuizQuestions } from "@/data/level-quiz";
import { profileExistsKey } from "@/hooks/useAuthState";
import { myProfileKey } from "@/hooks/useMyProfile";
import { stepEntering } from "@/lib/motion";
import { queryClient } from "@/lib/query-client";
import { getCurrentUser, getSuggestedName } from "@/repositories/auth-repository";
import { saveProfile } from "@/repositories/profile-repository";
import { errorMessage } from "@/lib/error-message";

type Step = 1 | 2 | 3;

const LAST_QUESTION = levelQuizQuestions.length - 1;
// Pause on the picked answer before moving to the next question, as in the design
const AUTO_ADVANCE_MS = 300;

/**
 * Profile setup after sign up. The steps (and the quiz questions in step 3)
 * swap in place on one screen, so the header and progress bar stay put.
 */
export default function ProfileSetup() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>(1);
  const [question, setQuestion] = useState(0);
  // Slide the next page in from the right, the previous one from the left
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [about, setAbout] = useState(initialAboutValues);
  const [game, setGame] = useState(initialGameValues);
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  const [aboutSubmitted, setAboutSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  // Players who signed in with Google already gave their name, so start from it
  useEffect(() => {
    getSuggestedName()
      .then(({ firstName, lastName }) =>
        setAbout((current) => ({
          ...current,
          firstName: current.firstName || firstName,
          lastName: current.lastName || lastName,
        })),
      )
      .catch(() => {});
  }, []);

  function goTo(next: Step, nextQuestion = 0) {
    clearTimeout(advanceTimer.current);
    setDirection(next > step || (next === step && nextQuestion > question) ? "forward" : "back");
    setStep(next);
    setQuestion(nextQuestion);
  }

  /** Returns false when there is nothing to go back to inside setup */
  function stepBack() {
    if (step === 3 && question > 0) goTo(3, question - 1);
    else if (step > 1) goTo((step - 1) as Step);
    else return false;
    return true;
  }

  function back() {
    if (stepBack()) return;
    if (router.canGoBack()) router.back();
    else router.replace("/sign-up");
  }

  function pickAnswer(answer: number) {
    setAnswers((current) => {
      const updated = [...current];
      updated[question] = answer;
      return updated;
    });
    if (question < LAST_QUESTION) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => goTo(3, question + 1), AUTO_ADVANCE_MS);
    }
  }

  async function finish() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        router.replace("/sign-in");
        return;
      }
      await saveProfile(user.id, about, game);
      await queryClient.invalidateQueries({ queryKey: myProfileKey });
      // Setup is done: from now on the app opens on Home
      queryClient.setQueryData(profileExistsKey(user.id), true);
      // The starting-level result screen isn't built yet, so setup goes straight to onboarding.
      // The quiz answers aren't scored yet; saveProfile gives everyone level 6.
      router.push("/onboarding");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("settings.saveFailed"),
        description: errorMessage(error),
      });
    } finally {
      setIsSaving(false);
    }
  }

  function next() {
    if (step === 1) {
      setAboutSubmitted(true);
      if (isAboutComplete(about)) goTo(2);
    } else if (step === 2) {
      goTo(3);
    } else if (question < LAST_QUESTION) {
      goTo(3, question + 1);
    } else {
      finish();
    }
  }

  // Android's back button steps back inside setup before leaving it
  useEffect(() => {
    if (step === 1) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", stepBack);
    return () => subscription.remove();
  });

  const isQuiz = step === 3;
  const isLastQuestion = isQuiz && question === LAST_QUESTION;
  const hasAnswer = answers[question] !== undefined;

  return (
    <Page variant="auth">
      {/* The iOS swipe-back would leave setup from a later step, so only allow it on step 1 */}
      <Stack.Screen options={{ gestureEnabled: step === 1 }} />
      <Page.Header
        back={back}
        leading={
          <SetupProgress
            step={step}
            stepProgress={isQuiz ? (question + 1) / levelQuizQuestions.length : 1}
          />
        }
      />

      {/* A new body per page starts it scrolled to the top */}
      <Page.Body key={`${step}-${question}`}>
        <Animated.View entering={stepEntering(direction)}>
          {step === 1 ? (
            <View className="gap-4">
              <SetupAboutStep values={about} onChange={setAbout} showErrors={aboutSubmitted} />
            </View>
          ) : step === 2 ? (
            <View className="gap-[34px] pt-2">
              <SetupGameStep values={game} onChange={setGame} />
            </View>
          ) : (
            <View className="gap-[22px] pt-1.5">
              <SetupQuizStep
                questions={levelQuizQuestions}
                index={question}
                answers={answers}
                onPick={pickAnswer}
              />
            </View>
          )}
        </Animated.View>
      </Page.Body>

      <Page.Footer className={isQuiz ? "flex-row gap-2.5" : undefined}>
        {isQuiz ? (
          <Button size="lg" variant="ghost" onPress={finish} isDisabled={isSaving} className="px-[18px]">
            <Button.Label className="text-muted">{t("setup.skip")}</Button.Label>
          </Button>
        ) : null}
        <Button
          size="lg"
          onPress={next}
          isDisabled={(isQuiz && !hasAnswer) || isSaving}
          className={isQuiz ? "flex-1" : undefined}
        >
          {isLastQuestion ? t("setup.seeLevel") : isQuiz ? t("setup.next") : t("setup.continue")}
        </Button>
      </Page.Footer>
    </Page>
  );
}
