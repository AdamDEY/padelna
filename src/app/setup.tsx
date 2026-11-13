import { router, Stack } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackHandler, View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { LoadingButton } from "@/components/loading-button";
import { Page } from "@/components/page";
import {
  initialAboutValues,
  isAboutComplete,
  SetupAboutStep,
} from "@/components/setup-about-step";
import { initialGameValues, SetupGameStep } from "@/components/setup-game-step";
import { SetupLevelCalculating } from "@/components/setup-level-calculating";
import { SetupLevelPick } from "@/components/setup-level-pick";
import { adjustedLevel, SetupLevelResult } from "@/components/setup-level-result";
import { SetupProgress } from "@/components/setup-progress";
import { SetupQuizStep } from "@/components/setup-quiz-step";
import { levelQuizQuestions, MIN_LEVEL } from "@/data/level-quiz";
import { profileExistsKey } from "@/hooks/useAuthState";
import { myProfileKey } from "@/hooks/useMyProfile";
import { scoreQuiz } from "@/lib/level-quiz-score";
import { CALCULATING_MS, stepEntering } from "@/lib/motion";
import { queryClient } from "@/lib/query-client";
import { getCurrentUser, getSuggestedName } from "@/repositories/auth-repository";
import { saveProfile } from "@/repositories/profile-repository";
import { errorMessage } from "@/lib/error-message";

type Step = 1 | 2 | 3;

const LAST_QUESTION = levelQuizQuestions.length - 1;
// Pause on the picked answer before moving to the next question, as in the design
const AUTO_ADVANCE_MS = 300;
// With Reduce Motion there is no animation to wait for, only a short beat so the change is noticed
const REDUCED_CALCULATING_MS = 600;

/**
 * Profile setup after sign up. The steps (and the quiz questions in step 3, then the
 * starting-level result) swap in place on one screen, so the header and progress bar stay put.
 */
export default function ProfileSetup() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState<Step>(1);
  const [question, setQuestion] = useState(0);
  // Slide the next page in from the right, the previous one from the left
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [about, setAbout] = useState(initialAboutValues);
  const [game, setGame] = useState(initialGameValues);
  const [answers, setAnswers] = useState<(number | undefined)[]>([]);
  // After the last question a short "working out your level" page shows first, then the starting level
  const [calculating, setCalculating] = useState(false);
  const [showResult, setShowResult] = useState(false);
  // Skip opens a list to choose a level from instead; nothing is chosen until the player picks
  const [picking, setPicking] = useState(false);
  const [selfLevel, setSelfLevel] = useState<number | undefined>(undefined);
  // How far the player moved the quiz level on the result page
  const [adjustment, setAdjustment] = useState(0);
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

  // The level the quiz gives (every question is answered by the time it is shown)
  const quiz = scoreQuiz(answers);
  const baseLevel = quiz?.level ?? MIN_LEVEL;
  // What gets saved: the picked level after Skip, otherwise the quiz level as moved on the result page
  const chosenLevel = picking ? selfLevel : adjustedLevel(baseLevel, adjustment);

  function goTo(next: Step, nextQuestion = 0) {
    clearTimeout(advanceTimer.current);
    setDirection(next > step || (next === step && nextQuestion > question) ? "forward" : "back");
    setStep(next);
    setQuestion(nextQuestion);
    setCalculating(false);
    setShowResult(false);
    setPicking(false);
  }

  /** Skip: the player chooses a level from a list instead of answering. */
  function openPicker() {
    clearTimeout(advanceTimer.current);
    setDirection("forward");
    setPicking(true);
  }

  /** The quiz is done: work the level out for a moment, then show it. */
  function openResult() {
    clearTimeout(advanceTimer.current);
    setDirection("forward");
    setAdjustment(0);
    setCalculating(true);
    advanceTimer.current = setTimeout(
      () => {
        setCalculating(false);
        setShowResult(true);
      },
      reduceMotion ? REDUCED_CALCULATING_MS : CALCULATING_MS,
    );
  }

  function retakeQuiz() {
    setAnswers([]);
    setAdjustment(0);
    setDirection("back");
    goTo(3, 0);
  }

  /** Returns false when there is nothing to go back to inside setup */
  function stepBack() {
    // From the pick list back to the question Skip was pressed on, answers kept
    if (picking) goTo(3, question);
    else if (calculating || showResult) goTo(3, LAST_QUESTION);
    else if (step === 3 && question > 0) goTo(3, question - 1);
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
      if (chosenLevel === undefined) return;
      await saveProfile(user.id, about, game, chosenLevel, picking ? "self" : "quiz");
      await queryClient.invalidateQueries({ queryKey: myProfileKey });
      // Setup is done: from now on the app opens on Home
      queryClient.setQueryData(profileExistsKey(user.id), true);
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
    } else if (picking || showResult) {
      finish();
    } else if (question < LAST_QUESTION) {
      goTo(3, question + 1);
    } else {
      openResult();
    }
  }

  // Android's back button steps back inside setup before leaving it
  useEffect(() => {
    if (step === 1) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", stepBack);
    return () => subscription.remove();
  });

  const isQuiz = step === 3;
  const isQuestion = isQuiz && !picking && !calculating && !showResult;
  const isLastQuestion = isQuestion && question === LAST_QUESTION;
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
            isDone={showResult}
          />
        }
      />

      {/* A new body per page starts it scrolled to the top */}
      <Page.Body key={`${step}-${question}-${picking}-${calculating}-${showResult}`}>
        {/* The result brings its own animation, so the page itself doesn't slide in */}
        <Animated.View entering={showResult ? undefined : stepEntering(direction)}>
          {step === 1 ? (
            <View className="gap-4">
              <SetupAboutStep values={about} onChange={setAbout} showErrors={aboutSubmitted} />
            </View>
          ) : step === 2 ? (
            <View className="gap-[34px] pt-2">
              <SetupGameStep values={game} onChange={setGame} />
            </View>
          ) : picking ? (
            <View className="gap-3.5 pt-1.5">
              <SetupLevelPick value={selfLevel} onChange={setSelfLevel} />
            </View>
          ) : calculating ? (
            <SetupLevelCalculating />
          ) : showResult ? (
            <View className="gap-4 pt-1.5">
              <SetupLevelResult
                baseLevel={baseLevel}
                adjustment={adjustment}
                onAdjust={setAdjustment}
                strongest={quiz?.strongest}
                weakest={quiz?.weakest}
              />
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
        {isQuiz && !calculating ? (
          <Button
            size="lg"
            variant="ghost"
            onPress={picking ? () => goTo(3, question) : showResult ? retakeQuiz : openPicker}
            isDisabled={isSaving}
            className="px-[18px]"
          >
            <Button.Label className={picking ? "text-accent" : "text-muted"}>
              {picking ? t("setup.pick.takeQuiz") : showResult ? t("setup.result.retake") : t("setup.skip")}
            </Button.Label>
          </Button>
        ) : null}
        <LoadingButton
          size="lg"
          onPress={next}
          // While the level is being worked out or saved the button spins instead of greying out
          isLoading={calculating || isSaving}
          isDisabled={(isQuestion && !hasAnswer) || (picking && selfLevel === undefined)}
          className={isQuiz ? "flex-1" : undefined}
        >
          {isLastQuestion || calculating
            ? t("setup.seeLevel")
            : isQuestion
              ? t("setup.next")
              : picking && selfLevel !== undefined
                ? t("setup.pick.continueWith", { level: selfLevel.toFixed(1) })
                : t("setup.continue")}
        </LoadingButton>
      </Page.Footer>
    </Page>
  );
}
