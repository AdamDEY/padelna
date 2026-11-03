import { Link, router } from "expo-router";
import { Button, Checkbox, FieldError, Input, Label, TextField, useToast } from "heroui-native";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Page } from "@/components/page";
import { signUp } from "@/repositories/auth-repository";
import { isEmail, MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { errorMessage } from "@/lib/error-message";

export default function SignUp() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const emailError = submitted && !isEmail(email);
  const passwordError = submitted && password.length < MIN_PASSWORD_LENGTH;
  const termsError = submitted && !acceptedTerms;

  async function createAccount() {
    setSubmitted(true);
    if (!isEmail(email) || password.length < MIN_PASSWORD_LENGTH || !acceptedTerms) return;
    setIsCreating(true);
    let hasSession: boolean;
    try {
      ({ hasSession } = await signUp(email, password));
    } catch (error) {
      toast.show({
        variant: "danger",
        label: t("auth.createFailed"),
        description: errorMessage(error),
      });
      return;
    } finally {
      setIsCreating(false);
    }
    if (hasSession) {
      router.replace("/setup");
    } else {
      // Email confirmation is on: there is no session until the player confirms
      toast.show({ label: t("auth.checkEmail"), description: t("auth.checkEmailText") });
      router.replace("/sign-in");
    }
  }

  function showLegal(name: string) {
    toast.show({ label: t("auth.legalSoon", { name }) });
  }

  return (
    <Page variant="auth">
      <Page.Header back={() => (router.canGoBack() ? router.back() : router.replace("/sign-in"))} />
      <Page.Body className="gap-5">
        <Page.Title description={t("auth.createText")}>
          {t("auth.createTitle")}
        </Page.Title>

        <View className="gap-4">
          <TextField isInvalid={emailError}>
            <Label>{t("auth.email")}</Label>
            <Input
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              keyboardType="email-address"
              returnKeyType="next"
            />
            <FieldError>{t("auth.emailError")}</FieldError>
          </TextField>

          <TextField isInvalid={passwordError}>
            <Label>{t("auth.password")}</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={t("auth.passwordPlaceholder", { count: MIN_PASSWORD_LENGTH })}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
            />
            <FieldError>{t("auth.passwordMin", { count: MIN_PASSWORD_LENGTH })}</FieldError>
          </TextField>

          <View className="gap-1">
            <View className="flex-row items-start gap-3">
              <Checkbox
                isSelected={acceptedTerms}
                onSelectedChange={setAcceptedTerms}
                isInvalid={termsError}
                accessibilityLabel={t("auth.agreeA11y")}
              />
              {/* Tapping the text also ticks the box; the two links open the documents */}
              <Pressable onPress={() => setAcceptedTerms((value) => !value)} className="flex-1">
                <Text className="font-normal text-[14px] leading-5 text-muted">
                  {t("auth.agreeTo")}{" "}
                  <Text className="font-bold text-link" onPress={() => showLegal(t("auth.terms"))}>
                    {t("auth.terms")}
                  </Text>{" "}
                  {t("auth.agreeAnd")}{" "}
                  <Text className="font-bold text-link" onPress={() => showLegal(t("auth.privacy"))}>
                    {t("auth.privacy")}
                  </Text>
                </Text>
              </Pressable>
            </View>
            {termsError ? (
              <Text className="ps-[34px] font-normal text-[13px] text-danger">
                {t("auth.acceptError")}
              </Text>
            ) : null}
          </View>
        </View>

        <Button size="lg" onPress={createAccount} isDisabled={isCreating}>
          {t("auth.createAccount")}
        </Button>

        <SocialAuthButtons />
      </Page.Body>

      <Page.Footer className="items-center">
        <Text className="font-normal text-[15px] text-muted">
          {t("auth.alreadyMember")}{" "}
          <Link href="/sign-in" replace className="font-bold text-link">
            {t("auth.signIn")}
          </Link>
        </Text>
      </Page.Footer>
    </Page>
  );
}
