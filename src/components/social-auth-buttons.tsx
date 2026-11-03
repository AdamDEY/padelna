import { router } from "expo-router";
import { Button, useToast } from "heroui-native";
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";

import { AppleMark, GoogleMark } from "@/components/brand-marks";
import { isAppleSignInAvailable } from "@/lib/apple-signin";
import { signInWithApple, signInWithGoogle } from "@/repositories/auth-repository";
import { hasProfile } from "@/repositories/profile-repository";
import { errorMessage } from "@/lib/error-message";

/**
 * "or" divider with the Google and Apple buttons (design: Sign in). Both cover
 * sign in and sign up: a player without a profile yet goes on to setup, everyone else to Home.
 */
export function SocialAuthButtons() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [hasApple, setHasApple] = useState(false);

  useEffect(() => {
    isAppleSignInAvailable().then(setHasApple);
  }, []);

  async function continueWith(signIn: () => Promise<string | null>, failure: string) {
    setIsSigningIn(true);
    try {
      const userId = await signIn();
      // They closed the sheet
      if (userId === null) return;
      router.replace((await hasProfile(userId)) ? "/" : "/setup");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: failure,
        description: errorMessage(error),
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  return (
    <View className="gap-[18px]">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line-input" />
        <Text className="font-bold text-[13px] text-muted">{t("auth.or")}</Text>
        <View className="h-px flex-1 bg-line-input" />
      </View>

      {/* Side by side as in the design; Google fills the row where Apple isn't available */}
      <View className="flex-row gap-3">
        <SocialButton
          label="Google"
          accessibilityLabel={t("auth.continueGoogle")}
          mark={<GoogleMark />}
          onPress={() => continueWith(signInWithGoogle, t("auth.googleFailed"))}
          isDisabled={isSigningIn}
        />
        {hasApple ? (
          <SocialButton
            label="Apple"
            accessibilityLabel={t("auth.continueApple")}
            mark={<AppleMark />}
            onPress={() => continueWith(signInWithApple, t("auth.appleFailed"))}
            isDisabled={isSigningIn}
          />
        ) : null}
      </View>
    </View>
  );
}

type SocialButtonProps = {
  label: string;
  accessibilityLabel: string;
  mark: ReactNode;
  onPress: () => void;
  isDisabled: boolean;
};

/** White outline button with the brand's mark to the left of its name (design: Sign in). */
function SocialButton({ label, accessibilityLabel, mark, onPress, isDisabled }: SocialButtonProps) {
  return (
    <Button
      variant="outline"
      onPress={onPress}
      isDisabled={isDisabled}
      accessibilityLabel={accessibilityLabel}
      className="h-[50px] flex-1 gap-2.5 rounded-[14px] border-line-input bg-surface"
    >
      {mark}
      <Button.Label className="font-bold text-[15px] text-foreground">{label}</Button.Label>
    </Button>
  );
}
