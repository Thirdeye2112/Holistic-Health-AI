import { Feather } from "@expo/vector-icons";
import { useSignIn, useSignUp } from "@clerk/expo";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  onClose: () => void;
};

type Screen = "signIn" | "signUp" | "verify";

export function AuthModal({ visible, onClose }: Props) {
  const colors = useColors();
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  const [screen, setScreen] = useState<Screen>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail("");
    setPassword("");
    setCode("");
    setError(null);
    setLoading(false);
    setScreen("signIn");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSignIn = async () => {
    if (!signInLoaded || !signIn) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });
      if (result.status === "complete") {
        await setSignInActive({ session: result.createdSessionId });
        handleClose();
      } else {
        setError("Sign in could not be completed. Please try again.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign in failed";
      const clerkMsg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message;
      setError(clerkMsg ?? msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      await signUp.create({ emailAddress: email.trim(), password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setScreen("verify");
    } catch (err: unknown) {
      const clerkMsg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message;
      setError(clerkMsg ?? "Sign up failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!signUpLoaded || !signUp) return;
    setLoading(true);
    setError(null);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setSignUpActive({ session: result.createdSessionId });
        handleClose();
      } else {
        setError("Verification could not be completed. Please try again.");
      }
    } catch (err: unknown) {
      const clerkMsg = (err as { errors?: { message: string }[] })?.errors?.[0]?.message;
      setError(clerkMsg ?? "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.sheetWrapper}
      >
        <ScrollView
          style={[styles.sheet, { backgroundColor: colors.card }]}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.dragHandle} />

          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.foreground }]}>
              {screen === "verify" ? "Check your email" : screen === "signIn" ? "Sign in" : "Create account"}
            </Text>
            <Pressable onPress={handleClose} hitSlop={12}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            {screen === "verify"
              ? `We sent a 6-digit code to ${email}. Enter it below.`
              : screen === "signIn"
                ? "Sign in to track your credits and consult history."
                : "New accounts start with 10 free credits."}
          </Text>

          {screen === "verify" ? (
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              maxLength={6}
              style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
            />
          ) : (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={colors.mutedForeground}
                secureTextEntry
                style={[styles.input, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]}
              />
            </>
          )}

          {error ? (
            <View style={[styles.errorBox, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}18` }]}>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={screen === "verify" ? handleVerify : screen === "signIn" ? handleSignIn : handleSignUp}
            disabled={loading}
            style={[styles.btn, { backgroundColor: colors.primary, opacity: loading ? 0.6 : 1 }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>
                {screen === "verify" ? "Verify" : screen === "signIn" ? "Sign in" : "Create account"}
              </Text>
            )}
          </Pressable>

          {screen !== "verify" && (
            <Pressable
              onPress={() => {
                setError(null);
                setScreen(screen === "signIn" ? "signUp" : "signIn");
              }}
              style={styles.switchRow}
            >
              <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
                {screen === "signIn" ? "Don't have an account? " : "Already have an account? "}
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                  {screen === "signIn" ? "Sign up" : "Sign in"}
                </Text>
              </Text>
            </Pressable>
          )}

          {screen === "verify" && (
            <Pressable
              onPress={() => setScreen("signUp")}
              style={styles.switchRow}
            >
              <Text style={[styles.switchText, { color: colors.mutedForeground }]}>
                Didn't receive the code?{" "}
                <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
                  Go back
                </Text>
              </Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheetWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  content: {
    padding: 24,
    gap: 14,
    paddingBottom: 40,
  },
  dragHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  btn: {
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 50,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  switchRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  switchText: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
