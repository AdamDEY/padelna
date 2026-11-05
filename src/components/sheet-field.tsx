import { cn } from "heroui-native";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

type SheetFieldProps = {
  label: string;
  /** Muted text after the label, e.g. "· 90 min" */
  detail?: string;
  className?: string;
  children: ReactNode;
};

/** Label above a field in a form sheet (14 px / 800), with optional muted detail after it. */
export function SheetField({ label, detail, className, children }: SheetFieldProps) {
  return (
    <View className={cn("gap-1.5", className)}>
      <Text className="font-bold text-[14px] text-foreground">
        {label}
        {detail ? <Text className="font-semibold text-muted"> {detail}</Text> : null}
      </Text>
      {children}
    </View>
  );
}
