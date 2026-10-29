import { Link, router } from "expo-router";
import { Button, Checkbox, FieldError, Input, Label, TextField, useToast } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { Page } from "@/components/page";
import { signUp } from "@/repositories/auth-repository";
import { isEmail, MIN_PASSWORD_LENGTH } from "@/lib/validation";

export default function SignUp() {
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
        label: "Couldn’t create your account",
        description: error instanceof Error ? error.message : "Please try again.",
      });
      return;
    } finally {
      setIsCreating(false);
    }
    if (hasSession) {
      router.replace("/setup");
    } else {
      // Email confirmation is on: there is no session until the player confirms
      toast.show({ label: "Check your email", description: "Confirm your address, then sign in." });
      router.replace("/sign-in");
    }
  }

  function showLegal(name: string) {
    toast.show({ label: `${name} coming soon` });
  }

  return (
    <Page variant="auth">
      <Page.Header back={() => (router.canGoBack() ? router.back() : router.replace("/sign-in"))} />
      <Page.Body className="gap-5">
        <Page.Title description="Join Tunisia’s padel community in a minute.">
          Create your account
        </Page.Title>

        <View className="gap-4">
          <TextField isInvalid={emailError}>
            <Label>Email</Label>
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
            <FieldError>Enter a valid email address.</FieldError>
          </TextField>

          <TextField isInvalid={passwordError}>
            <Label>Password</Label>
            <Input
              value={password}
              onChangeText={setPassword}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
            />
            <FieldError>{`Use at least ${MIN_PASSWORD_LENGTH} characters.`}</FieldError>
          </TextField>

          <View className="gap-1">
            <View className="flex-row items-start gap-3">
              <Checkbox
                isSelected={acceptedTerms}
                onSelectedChange={setAcceptedTerms}
                isInvalid={termsError}
                accessibilityLabel="I agree to the Terms and Privacy Policy"
              />
              {/* Tapping the text also ticks the box; the two links open the documents */}
              <Pressable onPress={() => setAcceptedTerms((value) => !value)} className="flex-1">
                <Text className="font-normal text-[14px] leading-5 text-muted">
                  I agree to the{" "}
                  <Text className="font-bold text-link" onPress={() => showLegal("Terms")}>
                    Terms
                  </Text>{" "}
                  and{" "}
                  <Text className="font-bold text-link" onPress={() => showLegal("Privacy Policy")}>
                    Privacy Policy
                  </Text>
                </Text>
              </Pressable>
            </View>
            {termsError ? (
              <Text className="ps-[34px] font-normal text-[13px] text-danger">
                Please accept to continue.
              </Text>
            ) : null}
          </View>
        </View>

        <Button size="lg" onPress={createAccount} isDisabled={isCreating}>
          Create account
        </Button>

        <SocialAuthButtons />
      </Page.Body>

      <Page.Footer className="items-center">
        <Text className="font-normal text-[15px] text-muted">
          Already a member?{" "}
          <Link href="/sign-in" replace className="font-bold text-link">
            Sign in
          </Link>
        </Text>
      </Page.Footer>
    </Page>
  );
}
