import { Button, cn } from "heroui-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

type LoadErrorProps = {
  /** What couldn't load and why, e.g. t("home.clubsFailed", { message: errorMessage(error) }) */
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
  className?: string;
};

/** A section that couldn't load: a muted line saying so and a small Try again button. */
export function LoadError({ message, onRetry, isRetrying = false, className }: LoadErrorProps) {
  const { t } = useTranslation();

  return (
    <View className={cn("items-start gap-2", className)}>
      <Text className="font-normal text-[14px] text-muted">{message}</Text>
      <Button size="sm" variant="secondary" onPress={onRetry} isDisabled={isRetrying}>
        {t("errors.tryAgain")}
      </Button>
    </View>
  );
}
