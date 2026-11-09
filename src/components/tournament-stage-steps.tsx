import { cn } from "heroui-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import type { Stage } from "@/lib/tournament-live";

const DOT_SIZE = 22;
const STEP_WIDTH = 64;

type TournamentStageStepsProps = {
  stages: Stage[];
  current: Stage;
};

/** Groups → Quarters → Semis → Final, the current one filled in (design "Tournament live"). */
export function TournamentStageSteps({ stages, current }: TournamentStageStepsProps) {
  const { t } = useTranslation();
  const currentIndex = stages.indexOf(current);

  return (
    <View
      accessible
      accessibilityLabel={t("tournaments.live.stageA11y", { stage: t(`tournaments.live.stage.${current}`) })}
      className="flex-row items-start"
    >
      {stages.map((stage, index) => {
        const isCurrent = index === currentIndex;
        const isDone = index < currentIndex;
        return (
          <Fragment key={stage}>
            {index > 0 ? <View className={cn("mt-[10px] h-0.5 flex-1", isDone || isCurrent ? "bg-accent" : "bg-line")} /> : null}
            <View className="items-center gap-1" style={{ width: STEP_WIDTH }}>
              <View
                className={cn("rounded-full", isCurrent || isDone ? "bg-accent" : "bg-out-of-range", isCurrent && "border-4 border-primary-soft")}
                style={{ width: DOT_SIZE, height: DOT_SIZE }}
              />
              <Text className={cn("text-[12px]", isCurrent ? "font-black text-foreground" : isDone ? "font-bold text-ink-2" : "font-semibold text-muted")}>
                {t(`tournaments.live.stage.${stage}`)}
              </Text>
            </View>
          </Fragment>
        );
      })}
    </View>
  );
}
