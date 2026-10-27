import { Link, router } from "expo-router";
import { Button, Checkbox, FieldError, Input, Label, TextField, useToast } from "heroui-native";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { Page } from "@/components/page";
import { isEmail, MIN_PASSWORD_LENGTH } from "@/lib/validation";

export default function SignUp() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError = submitted && !isEmail(email);
  const passwordError = submitted && password.length < MIN_PASSWORD_LENGTH;
  const termsError = submitted && !acceptedTerms;

  function createAccount() {
    setSubmitted(true);
    if (!isEmail(email) || password.length < MIN_PASSWORD_LENGTH || !acceptedTerms) return;
    // No accounts yet; the API will create it. Profile setup comes next once built.
    toast.show({ variant: "success", label: "Welcome to Padelna!" });
    router.replace("/");
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

        <Button size="lg" onPress={createAccount}>
          Create account
        </Button>
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
