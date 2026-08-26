import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useClerk } from "@clerk/expo";

import {
  BodyAreaSelector,
  compileBodyContext,
  emptyBodyAreas,
  type BodyAreasValue,
} from "@/components/BodyAreaSelector";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AuthModal } from "@/components/AuthModal";
import { PurchaseModal } from "@/components/PurchaseModal";
import {
  ImageAttachmentPicker,
  type ImageAttachment,
} from "@/components/ImageAttachmentPicker";
import { useAnalysis } from "@/context/AnalysisContext";
import { useUserContext } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";

const SEX_OPTIONS = ["Female", "Male", "Other"] as const;

type Mode = "light" | "standard" | "premium";

const MODE_CONFIG = {
  light: {
    label: "Light",
    cost: 0,
    icon: "star" as const,
    detail: "Try free · pick 3 disciplines",
  },
  standard: {
    label: "Standard",
    cost: 1,
    icon: "zap" as const,
    detail: "GPT-5.4 · All 10 disciplines",
  },
  premium: {
    label: "Premium",
    cost: 3,
    icon: "award" as const,
    detail: "3 AI models · All 10 disciplines",
  },
};

const LIGHT_MAX = 3;

const DISCIPLINE_OPTIONS = [
  { id: "conventional", name: "Conventional" },
  { id: "functional", name: "Functional" },
  { id: "naturopathic", name: "Naturopathic" },
  { id: "tcm", name: "Chinese Medicine" },
  { id: "ayurveda", name: "Ayurveda" },
  { id: "chiropractic", name: "Chiropractic" },
  { id: "osteopathic", name: "Osteopathic" },
  { id: "nutrition", name: "Nutrition" },
  { id: "psychology", name: "Mind-Body" },
  { id: "homeopathy", name: "Homeopathy" },
] as const;

export function ConsultForm() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { startAnalysis, status, error, history, setCurrentById, removeFromHistory } = useAnalysis();
  const { isSignedIn, credits, refreshCredits } = useUserContext();
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  const [ailment, setAilment] = useState("");
  const [age, setAge] = useState("");
  const [sex, setSex] = useState<string | null>(null);
  const [bodyAreas, setBodyAreas] = useState<BodyAreasValue>(emptyBodyAreas);
  const [mode, setMode] = useState<Mode>("premium");
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);

  const [showAuth, setShowAuth] = useState(false);
  const [showPurchase, setShowPurchase] = useState(false);
  const [image, setImage] = useState<ImageAttachment | null>(null);
  const [labResults, setLabResults] = useState("");

  const isLoading = status === "loading";
  const creditCost = MODE_CONFIG[mode].cost;
  const hasEnoughCredits = isSignedIn && credits !== null && credits >= creditCost;
  const lightReady = mode !== "light" || selectedDisciplines.length === LIGHT_MAX;
  const canSubmit = ailment.trim().length > 0 && lightReady;

  // Animated progress bar during analysis
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isLoading) {
      progressAnim.setValue(0);
      Animated.timing(progressAnim, {
        toValue: 0.85,
        duration: mode === "premium" ? 42000 : mode === "light" ? 10000 : 20000,
        useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(() => progressAnim.setValue(0));
    }
  }, [isLoading]);

  const toggleDiscipline = (id: string) => {
    setSelectedDisciplines((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id);
      if (prev.length >= LIGHT_MAX) return prev;
      return [...prev, id];
    });
  };

  const handleSubmit = async () => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    const ageNum = age.trim().length > 0 ? parseInt(age, 10) : null;
    const bodyContext = compileBodyContext(bodyAreas);
    await startAnalysis({
      ailment,
      age: Number.isFinite(ageNum as number) ? (ageNum as number) : null,
      sex: sex ?? null,
      history: bodyContext.length > 0 ? bodyContext : null,
      mode,
      disciplines: mode === "light" ? selectedDisciplines : null,
      imageBase64: image?.base64 ?? null,
      imageMimeType: image?.mimeType ?? null,
      labResults: labResults.trim() || null,
    });
    await refreshCredits();
  };

  const Container = isLoading ? ScrollView : KeyboardAwareScrollViewCompat;

  const submitLabel = isLoading
    ? "Consulting the panel…"
    : mode === "light" && !lightReady
    ? `Pick ${LIGHT_MAX - selectedDisciplines.length} more discipline${LIGHT_MAX - selectedDisciplines.length === 1 ? "" : "s"}`
    : mode === "light"
    ? "Analyze  ·  Free"
    : `Analyze  ·  ${creditCost} cr`;

  return (
    <>
      <Container
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: 36 + insets.bottom },
        ]}
        keyboardShouldPersistTaps="handled"
        bottomOffset={32}
      >
        {/* ── Brand & auth row ── */}
        <View style={styles.brandRow}>
          <View style={[styles.logoMark, { backgroundColor: colors.primary }]}>
            <Feather name="activity" size={18} color={colors.primaryForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.brand, { color: colors.foreground }]}>360* to Health</Text>
            <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
              Ten medical perspectives in one consult
            </Text>
          </View>

          {/* Auth hidden during testing */}
        </View>

        {/* ── Disclaimer ── */}
        <View style={[styles.disclaimer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Feather name="info" size={13} color={colors.mutedForeground} />
          <Text style={[styles.disclaimerText, { color: colors.mutedForeground }]}>
            For informational use only. Not intended to replace qualified medical advice, diagnosis, or treatment. Always consult a healthcare professional.
          </Text>
        </View>

        {/* ── Main concern — THE hero field ── */}
        <View style={styles.mainConcernBlock}>
          <Text style={[styles.mainConcernLabel, { color: colors.foreground }]}>
            What's going on?
          </Text>
          <View style={[styles.inputCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              value={ailment}
              onChangeText={setAilment}
              placeholder="Describe your symptoms or concern in your own words…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              editable={!isLoading}
              style={[styles.mainInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        {/* ── Context: age, sex, body area ── */}
        <View style={styles.contextPanel}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Age</Text>
              <TextInput
                value={age}
                onChangeText={(v) => setAge(v.replace(/[^0-9]/g, ""))}
                placeholder="—"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                editable={!isLoading}
                style={[
                  styles.smallInput,
                  { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border },
                ]}
              />
            </View>
            <View style={{ flex: 2 }}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Sex</Text>
              <View style={styles.sexRow}>
                {SEX_OPTIONS.map((opt) => {
                  const selected = sex === opt.toLowerCase();
                  return (
                    <Pressable
                      key={opt}
                      onPress={() => setSex(selected ? null : opt.toLowerCase())}
                      disabled={isLoading}
                      style={({ pressed }) => [
                        styles.sexChip,
                        {
                          backgroundColor: selected ? colors.primary : colors.card,
                          borderColor: selected ? colors.primary : colors.border,
                        },
                        pressed && Platform.OS !== "web" && { opacity: 0.85 },
                      ]}
                    >
                      <Text style={[styles.sexChipText, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                        {opt}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          <BodyAreaSelector value={bodyAreas} onChange={setBodyAreas} disabled={isLoading} />
        </View>

        {/* ── Attachments: photo + lab results ── */}
        <View style={styles.attachSection}>
          <Text style={[styles.attachLabel, { color: colors.mutedForeground }]}>
            Attach (optional)
          </Text>
          <ImageAttachmentPicker
            value={image}
            onChange={setImage}
            disabled={isLoading}
          />
          <View style={[styles.labCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="file-text" size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
            <TextInput
              value={labResults}
              onChangeText={setLabResults}
              placeholder="Paste lab results, blood work values, or test report text…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              editable={!isLoading}
              style={[styles.labInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        {/* ── Mode toggle ── */}
        <View style={styles.modeSection}>
          <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Analysis mode</Text>

          {/* Light — full-width, amber accent */}
          {(() => {
            const cfg = MODE_CONFIG.light;
            const selected = mode === "light";
            return (
              <Pressable
                onPress={() => setMode("light")}
                disabled={isLoading}
                style={[
                  styles.modeCardWide,
                  {
                    backgroundColor: selected ? colors.accent : colors.card,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}
              >
                <View style={styles.modeCardWideLeft}>
                  <Feather name={cfg.icon} size={15} color={selected ? "#fff" : colors.accent} />
                  <View>
                    <Text style={[styles.modeLabel, { color: selected ? "#fff" : colors.foreground }]}>
                      {cfg.label}
                    </Text>
                    <Text style={[styles.modeDetail, { color: selected ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>
                      {cfg.detail}
                    </Text>
                  </View>
                </View>
                <View style={[styles.modeCost, { backgroundColor: selected ? "rgba(255,255,255,0.25)" : `${colors.accent}22` }]}>
                  <Text style={[styles.modeCostText, { color: selected ? "#fff" : colors.accent }]}>
                    Free
                  </Text>
                </View>
              </Pressable>
            );
          })()}

          {/* Discipline picker — only when Light selected */}
          {mode === "light" && (
            <View style={[styles.disciplinePanel, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.disciplineHint, { color: colors.mutedForeground }]}>
                Choose {LIGHT_MAX} disciplines ({selectedDisciplines.length}/{LIGHT_MAX} selected)
              </Text>
              <View style={styles.disciplineGrid}>
                {DISCIPLINE_OPTIONS.map((d) => {
                  const picked = selectedDisciplines.includes(d.id);
                  const maxed = !picked && selectedDisciplines.length >= LIGHT_MAX;
                  return (
                    <Pressable
                      key={d.id}
                      onPress={() => !isLoading && toggleDiscipline(d.id)}
                      style={({ pressed }) => [
                        styles.disciplineChip,
                        {
                          backgroundColor: picked ? colors.accent : colors.card,
                          borderColor: picked ? colors.accent : colors.border,
                          opacity: maxed ? 0.4 : pressed ? 0.8 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.disciplineChipText, { color: picked ? "#fff" : colors.foreground }]}>
                        {d.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {/* Standard + Premium side by side */}
          <View style={styles.modeRow}>
            {(["standard", "premium"] as const).map((m) => {
              const cfg = MODE_CONFIG[m];
              const selected = mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  disabled={isLoading}
                  style={[
                    styles.modeCard,
                    {
                      backgroundColor: selected ? colors.primary : colors.card,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Feather name={cfg.icon} size={15} color={selected ? colors.primaryForeground : colors.mutedForeground} />
                  <Text style={[styles.modeLabel, { color: selected ? colors.primaryForeground : colors.foreground }]}>
                    {cfg.label}
                  </Text>
                  <Text style={[styles.modeDetail, { color: selected ? `${colors.primaryForeground}CC` : colors.mutedForeground }]}>
                    {cfg.detail}
                  </Text>
                  <View style={[styles.modeCost, { backgroundColor: selected ? "rgba(255,255,255,0.2)" : colors.surfaceMuted }]}>
                    <Text style={[styles.modeCostText, { color: selected ? colors.primaryForeground : colors.mutedForeground }]}>
                      {cfg.cost} cr
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ── Submit ── */}
        <Pressable
          onPress={handleSubmit}
          disabled={isLoading || !canSubmit}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: mode === "light" ? colors.accent : colors.primary,
              opacity: isLoading || !canSubmit ? 0.45 : pressed ? 0.9 : 1,
            },
          ]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Feather
              name={mode === "light" && !lightReady ? "list" : "search"}
              size={18}
              color={colors.primaryForeground}
            />
          )}
          <Text style={[styles.submitText, { color: colors.primaryForeground }]}>{submitLabel}</Text>
        </Pressable>

        {isLoading && (
          <>
            {/* Animated progress bar */}
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: mode === "light" ? colors.accent : colors.primary,
                    width: progressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            </View>
            <View style={styles.loadingHint}>
              <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>
                {mode === "premium"
                  ? "GPT-5.4, Claude, and Gemini are reviewing your case across all 10 disciplines. Usually 30–50 seconds."
                  : mode === "light"
                  ? `GPT-5.4 is reviewing your ${LIGHT_MAX} chosen disciplines. Usually 10–20 seconds.`
                  : "GPT-5.4 is reviewing your case across all 10 disciplines. Usually 15–25 seconds."}
              </Text>
            </View>
          </>
        )}

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}14` }]}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        {/* ── Recent consults ── */}
        {history.length > 0 && (
          <View style={styles.historySection}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recent consults</Text>
            <View style={{ gap: 10 }}>
              {history.slice(0, 8).map((h) => (
                <View
                  key={h.id}
                  style={[
                    styles.historyItem,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Pressable
                    onPress={() => setCurrentById(h.id)}
                    style={({ pressed }) => [
                      styles.historyMain,
                      pressed && Platform.OS !== "web" && { opacity: 0.8 },
                    ]}
                  >
                    <View style={{ flex: 1, gap: 4 }}>
                      <Text style={[styles.historyText, { color: colors.foreground }]} numberOfLines={2}>
                        {h.ailment}
                      </Text>
                      <Text style={[styles.historyMeta, { color: colors.mutedForeground }]}>
                        {formatTime(h.createdAt)} · {h.result.perspectives.length} perspectives
                        {h.followupAnswers.length > 0 ? ` · refined ×${h.followupAnswers.length}` : ""}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    onPress={() => removeFromHistory(h.id)}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.historyDelete,
                      { borderColor: colors.border },
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
              ))}
            </View>
          </View>
        )}
      </Container>

      <AuthModal visible={showAuth} onClose={() => setShowAuth(false)} />
      <PurchaseModal
        visible={showPurchase}
        onClose={() => setShowPurchase(false)}
        getToken={getToken}
        onPurchased={refreshCredits}
      />
    </>
  );
}

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 18,
    gap: 16,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  brand: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  tagline: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
  authRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  creditBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  creditCount: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  signInBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  signInBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  disclaimer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
  },
  mainConcernBlock: {
    gap: 10,
  },
  mainConcernLabel: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  inputCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  mainInput: {
    minHeight: 100,
    fontSize: 16,
    lineHeight: 23,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  attachSection: {
    gap: 10,
  },
  attachLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  labCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  labInput: {
    flex: 1,
    minHeight: 72,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  contextPanel: {
    gap: 14,
    marginTop: -4,
  },
  row: {
    flexDirection: "row",
    gap: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
    marginBottom: 6,
  },
  smallInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    minHeight: 44,
  },
  sexRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sexChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  sexChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  modeSection: {
    gap: 8,
  },
  modeCardWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modeCardWideLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  disciplinePanel: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  disciplineHint: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  disciplineGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  disciplineChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  disciplineChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    alignItems: "flex-start",
  },
  modeLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  modeDetail: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 15,
  },
  modeCost: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  modeCostText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  submit: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.1,
  },
  progressTrack: {
    height: 4,
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
  },
  loadingHint: {
    paddingHorizontal: 6,
    alignItems: "center",
  },
  loadingText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  historySection: {
    marginTop: 4,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  historyMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyDelete: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
  },
  historyText: {
    fontSize: 14.5,
    lineHeight: 20,
    fontFamily: "Inter_500Medium",
  },
  historyMeta: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
  },
});
