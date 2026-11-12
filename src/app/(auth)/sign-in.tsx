import { Link, router } from "expo-router";
import { Button, FieldError, Input, InputGroup, Label, TextField, useToast } from "heroui-native";
import { Eye, EyeOff } from "lucide-react-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/icon";
import { Page } from "@/components/page";
import { PadelnaLogo } from "@/components/padelna-logo";
import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { useHeroStatusBar } from "@/hooks/useHeroStatusBar";
import { signIn as signInWithPassword } from "@/repositories/auth-repository";
import { hasProfile } from "@/repositories/profile-repository";
import { isEmail, isEmailOrPhone } from "@/lib/validation";
import { errorMessage } from "@/lib/error-message";

// The design is drawn for a 44 pt status bar; taller ones push everything down
const DESIGN_STATUS_BAR = 44;
// The hero ends where the form sheet starts
const HERO_HEIGHT = 300;
const LOGO_TOP = 78;
// Page.Body pads its end by this much when a footer is pinned below it
const BODY_END_PADDING = 24;

export default function SignIn() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const shift = Math.max(0, insets.top - DESIGN_STATUS_BAR);
  // White status bar text over the dark hero, dark again once it scrolls away
  const { onHeroLayout, onScrollY } = useHeroStatusBar();
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const identifierError = submitted && !isEmailOrPhone(identifier);
  const passwordError = submitted && password.length === 0;

  async function signIn() {
    setSubmitted(true);
    if (!isEmailOrPhone(identifier) || password.length === 0) return;
    if (!isEmail(identifier)) {
      // Phone sign-in needs an SMS provider
      toast.show({ label: t("auth.phoneSoon"), description: t("auth.phoneSoonText") });
      return;
    }
    setIsSigningIn(true);
    let userId: string;
    try {
      userId = await signInWithPassword(identifier, password);
    } catch (error) {
      setIsSigningIn(false);
      toast.show({
        variant: "danger",
        label: t("auth.signInFailed"),
        description: errorMessage(error),
      });
      return;
    }
    try {
      // A player who signed up but never finished setup picks it up where they left off
      router.replace((await hasProfile(userId)) ? "/" : "/setup");
    } catch {
      setIsSigningIn(false);
      toast.show({
        variant: "danger",
        label: t("auth.wentWrong"),
        description: t("settings.tryAgain"),
      });
    }
  }

  return (
    <Page variant="auth" underStatusBar dark>
      <Page.Body className="gap-0 px-0" onScrollY={onScrollY}>
        {/* Dark hero: the logo over two faint lime rings, like court lines */}
        <View
          onLayout={onHeroLayout}
          className="items-center gap-3.5 overflow-hidden bg-ink"
          style={{ height: HERO_HEIGHT + shift, paddingTop: LOGO_TOP + shift }}
        >
          <View
            aria-hidden
            className="absolute -end-[70px] -top-[90px] size-[260px] rounded-full border-2 border-lime opacity-[0.16]"
          />
          <View
            aria-hidden
            className="absolute -start-[120px] top-[160px] size-[240px] rounded-full border-2 border-lime opacity-10"
          />
          <PadelnaLogo />
          <Text className="font-semibold text-[15px] text-ink-tint-text">{t("auth.tagline")}</Text>
        </View>

        {/* The form sheet slides over the hero; it also covers the body's bottom padding */}
        <View
          className="grow gap-[18px] rounded-t-[32px] bg-background px-6 pt-7"
          style={{ marginBottom: -BODY_END_PADDING }}
        >
          <View className="gap-1.5">
            <Text
              accessibilityRole="header"
              className="font-black text-[30px] tracking-[-0.5px] text-foreground"
            >
              {t("auth.welcomeBack")}
            </Text>
            <Text className="font-normal text-[16px] text-muted">{t("auth.signInText")}</Text>
          </View>

          <TextField isInvalid={identifierError}>
            <Label>{t("auth.emailOrPhone")}</Label>
            <Input
              value={identifier}
              onChangeText={setIdentifier}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <FieldError>{t("auth.identifierError")}</FieldError>
          </TextField>

          <TextField isInvalid={passwordError}>
            <View className="flex-row items-baseline justify-between">
              <Label>{t("auth.password")}</Label>
              <Text
                accessibilityRole="link"
                onPress={() =>
                  toast.show({
                    label: t("auth.forgotSoon"),
                    description: t("auth.forgotSoonText"),
                  })
                }
                suppressHighlighting
                className="font-semibold text-[14px] text-link"
              >
                {t("auth.forgot")}
              </Text>
            </View>
            <InputGroup>
              <InputGroup.Input
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                returnKeyType="go"
                onSubmitEditing={signIn}
              />
              <InputGroup.Suffix>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t(showPassword ? "auth.hidePassword" : "auth.showPassword")}
                  hitSlop={8}
                  onPress={() => setShowPassword((shown) => !shown)}
                  className="size-11 items-center justify-center"
                >
                  {/* The icon shows the state: open eye = visible, crossed eye = hidden */}
                  <Icon as={showPassword ? Eye : EyeOff} color="muted" size={22} />
                </Pressable>
              </InputGroup.Suffix>
            </InputGroup>
            <FieldError>{t("auth.passwordError")}</FieldError>
          </TextField>

          <Button size="lg" onPress={signIn} isDisabled={isSigningIn} className="mt-1">
            {t("auth.signIn")}
          </Button>

          <SocialAuthButtons />
        </View>
      </Page.Body>

      <Page.Footer className="items-center bg-background">
        <Text className="font-normal text-[15px] text-muted">
          {t("auth.newTo")}{" "}
          <Link href="/sign-up" replace className="font-bold text-link">
            {t("auth.createLink")}
          </Link>
        </Text>
      </Page.Footer>
    </Page>
  );
}
