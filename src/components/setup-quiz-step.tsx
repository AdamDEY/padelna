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
  const question = questions[index];

  return (
    <>
      <View className="gap-2">
        <Text className="font-bold text-[13px] uppercase tracking-[0.6px] text-accent">
          Level quiz · Question {index + 1} of {questions.length}
        </Text>
        <Text
          accessibilityRole="header"
          className="font-black text-[26px] leading-[31px] tracking-[-0.4px] text-foreground"
        >
          {question.title}
        </Text>
      </View>

      <View accessibilityRole="radiogroup" accessibilityLabel={question.title} className="gap-2.5">
        {question.answers.map((label, answer) => (
          <AnswerCard
            key={label}
            label={label}
            isSelected={answers[index] === answer}
            onPress={() => onPick(answer)}
          />
        ))}
      </View>

      <Text className="text-center font-normal text-[13px] leading-[19px] text-muted">
        There are no wrong answers. Your level gets confirmed by the players you meet on court.
      </Text>
    </>
  );
}
