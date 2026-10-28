import { Link, router } from "expo-router";
import { Button, FieldError, Input, Label, TextField, useToast } from "heroui-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Page } from "@/components/page";
import { PadelnaLogo } from "@/components/padelna-logo";
import { hasProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { isEmail, isEmailOrPhone } from "@/lib/validation";

// The design is drawn for a 44 pt status bar; taller ones push everything down
const DESIGN_STATUS_BAR = 44;
const HERO_HEIGHT = 300;

export default function SignIn() {
  const insets = useSafeAreaInsets();
  const shift = Math.max(0, insets.top - DESIGN_STATUS_BAR);
  // Court drawing starts below the logo row
  const courtTop = insets.top + 70;
  const { toast } = useToast();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const identifierError = submitted && !isEmailOrPhone(identifier);
  const passwordError = submitted && password.length === 0;

  async function signIn() {
    setSubmitted(true);
    if (!isEmailOrPhone(identifier) || password.length === 0) return;
    if (!isEmail(identifier)) {
      // Phone sign-in needs an SMS provider
      toast.show({ label: "Phone sign-in is coming soon", description: "For now, use your email." });
      return;
    }
    setIsSigningIn(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: identifier.trim(),
      password,
    });
    if (error) {
      setIsSigningIn(false);
      toast.show({ variant: "danger", label: "Couldn’t sign you in", description: error.message });
      return;
    }
    try {
      // A player who signed up but never finished setup picks it up where they left off
      router.replace((await hasProfile(data.user.id)) ? "/" : "/setup");
    } catch {
      setIsSigningIn(false);
      toast.show({ variant: "danger", label: "Something went wrong", description: "Please try again." });
    }
  }

  return (
    <Page variant="auth" underStatusBar>
      <Page.Body className="gap-[18px] px-0">
        {/* Court illustration with the logo, rounded at the bottom */}
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          className="overflow-hidden rounded-b-[36px] bg-court-blue"
          style={{ height: HERO_HEIGHT + shift }}
        >
          <View
            className="absolute inset-x-[70px] -bottom-10 rounded-md border-2 border-white/90"
            style={{ top: courtTop }}
          />
          <View className="absolute inset-x-[70px] h-[3px] bg-white" style={{ top: courtTop + 120 }} />
          <View className="absolute inset-x-[70px] h-0.5 bg-white/70" style={{ top: courtTop + 60 }} />
          <View className="absolute left-1/2 h-[60px] w-0.5 bg-white/70" style={{ top: courtTop }} />
          <View
            className="absolute left-[60%] size-[22px] rounded-full bg-lime"
            style={{ top: courtTop + 82 }}
          />
        </View>
        <View className="absolute start-6" style={{ top: insets.top + 8 }}>
          <PadelnaLogo />
        </View>

        <View className="gap-[18px] px-6 pt-2.5">
          <View className="gap-1.5">
            <Text
              accessibilityRole="header"
              className="font-black text-[30px] tracking-[-0.5px] text-foreground"
            >
              Welcome back
            </Text>
            <Text className="font-normal text-[16px] text-muted">Sign in to find your next match.</Text>
          </View>

          <TextField isInvalid={identifierError}>
            <Label>Email or phone</Label>
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
            <FieldError>Enter your email or a Tunisian phone number.</FieldError>
          </TextField>

          <TextField isInvalid={passwordError}>
            <View className="flex-row items-baseline justify-between">
              <Label>Password</Label>
              <Text
                accessibilityRole="link"
                onPress={() =>
                  toast.show({
                    label: "Password reset is coming soon",
                    description: "For now, ask us at hello@padelna.tn.",
                  })
                }
                suppressHighlighting
                className="font-semibold text-[14px] text-link"
              >
                Forgot?
              </Text>
            </View>
            <Input
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={signIn}
            />
            <FieldError>Enter your password.</FieldError>
          </TextField>

          <Button size="lg" onPress={signIn} isDisabled={isSigningIn} className="mt-1">
            Sign in
          </Button>
        </View>
      </Page.Body>

      <Page.Footer className="items-center">
        <Text className="font-normal text-[15px] text-muted">
          New to Padelna?{" "}
          <Link href="/sign-up" replace className="font-bold text-link">
            Create an account
          </Link>
        </Text>
      </Page.Footer>
    </Page>
  );
}
