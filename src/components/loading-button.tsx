import { Button, Spinner } from "heroui-native";
import type { ComponentProps } from "react";
import { useCSSVariable } from "uniwind";

type ButtonProps = ComponentProps<typeof Button>;

type LoadingButtonProps = {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  onPress?: ButtonProps["onPress"];
  isDisabled?: boolean;
  className?: string;
  accessibilityLabel?: string;
  /** Show the spinner and ignore taps while something is being sent or loaded */
  isLoading?: boolean;
  children: string;
};

/**
 * A HeroUI Button that shows a spinner next to its label while it works. It keeps its colour (a
 * greyed-out button with a spinner reads as "disabled", not "working") and ignores taps, so
 * nothing is sent twice. Use it for every button that waits on the network or a calculation.
 */
export function LoadingButton({
  isLoading = false,
  variant,
  onPress,
  isDisabled,
  children,
  ...props
}: LoadingButtonProps) {
  const onAccent = useCSSVariable("--color-accent-foreground") as string;
  const onNeutral = useCSSVariable("--color-foreground") as string;
  // Solid buttons have white text, every other variant has dark or blue text
  const spinnerColor = variant === undefined || variant === "primary" ? onAccent : onNeutral;

  return (
    <Button
      {...props}
      variant={variant}
      isDisabled={isDisabled}
      onPress={isLoading ? undefined : onPress}
      accessibilityState={{ busy: isLoading, disabled: isDisabled }}
    >
      {isLoading ? <Spinner size="sm" color={spinnerColor} /> : null}
      <Button.Label>{children}</Button.Label>
    </Button>
  );
}
