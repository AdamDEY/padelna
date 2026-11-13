import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AnswerCard } from "@/components/answer-card";
import type { QuizQuestion } from "@/data/level-quiz";

type SetupQuizStepProps = {
  questions: QuizQuestion[];
  /** Index of the question on screen */
  index: number;
  /** Chosen answer index per question */
  answers: (number | undefined)[];
  onPick: (answer: number) => void;
};

/** Profile setup step 3, the level quiz: one question at a time with answer cards. */
export function SetupQuizStep({ questions, index, answers, onPick }: SetupQuizStepProps) {
  const { t } = useTranslation();
  const question = questions[index];
  const title = t(`quiz.${question.id}.title`);

  return (
    <>
      <View className="gap-2">
        <Text className="font-bold text-[13px] uppercase tracking-[0.6px] text-accent-text">
          {t("setup.quizEyebrow", { number: index + 1, total: questions.length })}
        </Text>
        <Text
          accessibilityRole="header"
          className="font-black text-[26px] leading-[31px] tracking-[-0.4px] text-foreground"
        >
          {title}
        </Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel={title} className="gap-2.5">
        {question.answers.map((answer) => (
          <AnswerCard
            key={answer}
            // Not every question has all five answers, so the key is checked by the language files, not by type
            label={t(`quiz.${question.id}.a${answer}` as ParseKeys)}
            isSelected={answers[index] === answer}
            onPress={() => onPick(answer)}
          />
        ))}
      </View>

      <Text className="text-center font-normal text-[13px] leading-[19px] text-muted">
        {t("setup.noWrong")}
      </Text>
    </>
  );
}
