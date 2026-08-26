import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  buildAnswerPayload,
  getDraftKey,
  PerspectiveCard,
} from "@/components/PerspectiveCard";
import {
  ImageAttachmentPicker,
  type ImageAttachment,
} from "@/components/ImageAttachmentPicker";
import { useAnalysis, type HistoryEntry } from "@/context/AnalysisContext";
import { useUserContext } from "@/context/UserContext";
import { useColors } from "@/hooks/useColors";
import type { FollowupAnswer } from "@workspace/api-client-react";

type Props = {
  entry: HistoryEntry;
  loadingRefine: boolean;
  onClose: () => void;
};

type RefineContext = {
  submittedAt: number;
  answers: FollowupAnswer[];
};

export function ResultsView({ entry, loadingRefine, onClose }: Props) {
  const colors = useColors();
  const { refineWithAnswers } = useAnalysis();
  const { credits, isSignedIn } = useUserContext();
  const scrollRef = useRef<ScrollView>(null);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [allExpanded, setAllExpanded] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [globalUpdate, setGlobalUpdate] = useState("");
  const [refineImage, setRefineImage] = useState<ImageAttachment | null>(null);
  const [refineLabResults, setRefineLabResults] = useState("");
  const [refineCtx, setRefineCtx] = useState<RefineContext | null>(null);

  const draftCount = useMemo(() => {
    const perCard = Object.values(drafts).filter((v) => v.trim().length > 0).length;
    return (
      perCard +
      (globalUpdate.trim().length > 0 ? 1 : 0) +
      (refineImage ? 1 : 0) +
      (refineLabResults.trim().length > 0 ? 1 : 0)
    );
  }, [drafts, globalUpdate, refineImage, refineLabResults]);

  const answeredCount = entry.followupAnswers.length;

  const toggleCard = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allExpanded) {
      setExpandedIds(new Set());
      setAllExpanded(false);
    } else {
      setExpandedIds(new Set(entry.result.perspectives.map((p) => p.disciplineId)));
      setAllExpanded(true);
    }
  }, [allExpanded, entry.result.perspectives]);

  const handleRefine = useCallback(async () => {
    const answers = buildAnswerPayload(entry.result.perspectives, drafts);
    if (globalUpdate.trim().length > 0) {
      answers.unshift({
        disciplineId: "shared",
        question: "Additional context",
        answer: globalUpdate.trim(),
      });
    }
    if (answers.length === 0) return;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Success,
      ).catch(() => {});
    }

    setDrafts({});
    setGlobalUpdate("");
    const media = {
      imageBase64: refineImage?.base64 ?? null,
      imageMimeType: refineImage?.mimeType ?? null,
      labResults: refineLabResults.trim() || null,
    };
    setRefineImage(null);
    setRefineLabResults("");

    await refineWithAnswers(answers, media);

    setRefineCtx({ submittedAt: Date.now(), answers });

    setExpandedIds(
      new Set(entry.result.perspectives.map((p) => p.disciplineId)),
    );

    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }, 150);
  }, [drafts, globalUpdate, refineImage, refineLabResults, entry.result.perspectives, refineWithAnswers]);

  const dismissRefineCtx = useCallback(() => setRefineCtx(null), []);

  const justUpdated = refineCtx !== null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeButton,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
              pressed && Platform.OS !== "web" && { opacity: 0.7 },
            ]}
          >
            <Feather name="arrow-left" size={20} color={colors.foreground} />
          </Pressable>
          <View style={styles.headerLabels}>
            <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>
              Multi-discipline analysis
            </Text>
          </View>
          <Pressable
            onPress={toggleAll}
            hitSlop={8}
            style={({ pressed }) => [
              styles.expandAllBtn,
              { borderColor: colors.border, backgroundColor: colors.surface },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Feather name={allExpanded ? "minimize-2" : "maximize-2"} size={13} color={colors.mutedForeground} />
            <Text style={[styles.expandAllText, { color: colors.mutedForeground }]}>
              {allExpanded ? "Collapse" : "Expand all"}
            </Text>
          </Pressable>
        </View>

        <Text style={[styles.ailment, { color: colors.foreground }]}>
          {entry.ailment}
        </Text>

        {justUpdated && refineCtx ? (
          <View
            style={[
              styles.updateBanner,
              {
                backgroundColor: `${colors.primary}12`,
                borderColor: colors.primary,
              },
            ]}
          >
            <View style={styles.updateBannerHead}>
              <View style={styles.updateBannerLeft}>
                <Feather name="check-circle" size={15} color={colors.primary} />
                <Text
                  style={[styles.updateBannerTitle, { color: colors.primary }]}
                >
                  All {entry.result.perspectives.length} perspectives updated
                </Text>
              </View>
              <Pressable
                onPress={dismissRefineCtx}
                hitSlop={10}
                style={({ pressed }) => [pressed && { opacity: 0.6 }]}
              >
                <Feather name="x" size={16} color={colors.primary} />
              </Pressable>
            </View>
            <Text
              style={[
                styles.updateBannerSub,
                { color: colors.mutedForeground },
              ]}
            >
              Re-analyzed with {refineCtx.answers.length}{" "}
              {refineCtx.answers.length === 1 ? "answer" : "answers"} you
              provided. Each card shows the context that was applied.
            </Text>
            <View
              style={[
                styles.updateBannerDivider,
                { backgroundColor: `${colors.primary}30` },
              ]}
            />
            {refineCtx.answers.map((a, i) => (
              <View key={i} style={styles.updateBannerAnswer}>
                <Text
                  style={[
                    styles.updateBannerQ,
                    { color: colors.foreground },
                  ]}
                >
                  {a.question}
                </Text>
                <Text
                  style={[
                    styles.updateBannerA,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {a.answer}
                </Text>
              </View>
            ))}
          </View>
        ) : answeredCount > 0 ? (
          <View
            style={[
              styles.refinedBadge,
              {
                backgroundColor: colors.surfaceMuted,
                borderColor: colors.border,
              },
            ]}
          >
            <Feather name="git-merge" size={12} color={colors.primary} />
            <Text style={[styles.refinedText, { color: colors.foreground }]}>
              Refined with {answeredCount}{" "}
              {answeredCount === 1 ? "answer" : "answers"}
            </Text>
          </View>
        ) : null}

        {entry.result.redFlags.length > 0 ? (
          <View
            style={[
              styles.redFlagBox,
              {
                borderColor: colors.destructive,
                backgroundColor: `${colors.destructive}14`,
              },
            ]}
          >
            <View style={styles.redFlagHead}>
              <Feather
                name="alert-triangle"
                size={16}
                color={colors.destructive}
              />
              <Text
                style={[styles.redFlagTitle, { color: colors.destructive }]}
              >
                Red flags — consider urgent care
              </Text>
            </View>
            {entry.result.redFlags.map((rf, i) => (
              <Text
                key={i}
                style={[styles.redFlagItem, { color: colors.foreground }]}
              >
                • {rf}
              </Text>
            ))}
          </View>
        ) : null}

        {entry.result.crossDisciplinaryThemes.length > 0 ? (
          <View
            style={[
              styles.themesBox,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={styles.themesHead}>
              <Feather name="layers" size={14} color={colors.primary} />
              <Text style={[styles.themesTitle, { color: colors.foreground }]}>
                Cross-discipline patterns
              </Text>
            </View>
            {entry.result.crossDisciplinaryThemes.map((t, i) => (
              <View key={i} style={styles.themeItem}>
                <View
                  style={[
                    styles.themeDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text style={[styles.themeText, { color: colors.foreground }]}>
                  {t}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.cards}>
          {entry.result.perspectives.map((p) => {
            const expanded = expandedIds.has(p.disciplineId);

            const appliedAnswers = refineCtx
              ? refineCtx.answers.filter(
                  (a) =>
                    a.disciplineId === p.disciplineId ||
                    a.disciplineId === "shared",
                )
              : [];

            return (
              <PerspectiveCard
                key={p.disciplineId}
                perspective={p}
                expanded={expanded}
                onToggle={() => toggleCard(p.disciplineId)}
                draftAnswers={Object.fromEntries(
                  p.followUpQuestions.map((q) => [
                    q,
                    drafts[getDraftKey(p.disciplineId, q)] ?? "",
                  ]),
                )}
                onAnswerChange={(question, answer) =>
                  setDrafts((prev) => ({
                    ...prev,
                    [getDraftKey(p.disciplineId, question)]: answer,
                  }))
                }
                justUpdated={justUpdated}
                appliedAnswers={appliedAnswers}
              />
            );
          })}
        </View>

        {/* ── Share more information (after reading cards) ── */}
        <View
          style={[
            styles.globalUpdateBox,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={styles.globalUpdateHead}>
            <Feather name="edit-3" size={14} color={colors.primary} />
            <Text style={[styles.globalUpdateLabel, { color: colors.foreground }]}>
              Share more information
            </Text>
          </View>
          <Text style={[styles.globalUpdateSub, { color: colors.mutedForeground }]}>
            Add any new context or corrections — all perspectives will be updated at once.
          </Text>
          <TextInput
            value={globalUpdate}
            onChangeText={setGlobalUpdate}
            placeholder="e.g., symptoms started after a recent trip, currently taking ibuprofen…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.globalUpdateInput,
              {
                color: colors.foreground,
                borderColor: globalUpdate.trim().length > 0 ? colors.primary : colors.border,
                backgroundColor: colors.background,
              },
            ]}
          />

          <View style={[styles.attachDivider, { backgroundColor: colors.border }]} />

          <Text style={[styles.attachLabel, { color: colors.mutedForeground }]}>
            Attach image
          </Text>
          <ImageAttachmentPicker
            value={refineImage}
            onChange={setRefineImage}
            disabled={loadingRefine}
          />

          <View style={[styles.labCard, { backgroundColor: colors.background, borderColor: refineLabResults.trim().length > 0 ? colors.primary : colors.border }]}>
            <Feather name="file-text" size={14} color={colors.mutedForeground} style={{ marginTop: 2 }} />
            <TextInput
              value={refineLabResults}
              onChangeText={setRefineLabResults}
              placeholder="Paste lab results, blood work values, or test report text…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              editable={!loadingRefine}
              style={[styles.labInput, { color: colors.foreground }]}
            />
          </View>
        </View>

        <Text style={[styles.disclaimer, { color: colors.mutedForeground }]}>
          360* to Health is for educational and informational purposes only and
          does not replace professional medical diagnosis or treatment. Consult a
          qualified clinician for any health concern.
        </Text>

        <View style={{ height: 96 }} />
      </ScrollView>

      {draftCount > 0 && !loadingRefine ? (
        <View
          style={[
            styles.refineDock,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.refineDockText}>
            <Text
              style={[styles.refineDockTitle, { color: colors.foreground }]}
            >
              {draftCount} {draftCount === 1 ? "answer" : "answers"} ready
            </Text>
            <Text
              style={[
                styles.refineDockSubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              All perspectives will re-analyze with your input
            </Text>
          </View>
          <Pressable
            onPress={handleRefine}
            style={({ pressed }) => [
              styles.refineButton,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="zap" size={16} color={colors.primaryForeground} />
            <Text
              style={[
                styles.refineButtonText,
                { color: colors.primaryForeground },
              ]}
            >
              Refine all
            </Text>
          </Pressable>
        </View>
      ) : null}

      {loadingRefine ? (
        <View
          style={[
            styles.refineDock,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <View style={styles.refineDockText}>
            <Text
              style={[styles.refineDockTitle, { color: colors.foreground }]}
            >
              Re-analyzing all perspectives…
            </Text>
            <Text
              style={[
                styles.refineDockSubtitle,
                { color: colors.mutedForeground },
              ]}
            >
              Each discipline is incorporating your answers
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerLabels: {
    flex: 1,
    gap: 2,
  },
  expandAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  expandAllText: {
    fontSize: 11.5,
    fontFamily: "Inter_500Medium",
  },
  creditPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  creditPillText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  eyebrow: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.4,
  },
  ailment: {
    fontSize: 24,
    lineHeight: 30,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  updateBanner: {
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  updateBannerHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  updateBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  updateBannerTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.1,
  },
  updateBannerSub: {
    fontSize: 12.5,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  updateBannerDivider: {
    height: 1,
    borderRadius: 1,
    marginVertical: 2,
  },
  updateBannerAnswer: {
    gap: 2,
  },
  updateBannerQ: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 17,
  },
  updateBannerA: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    fontStyle: "italic",
  },
  refinedBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  refinedText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  redFlagBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },
  redFlagHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  redFlagTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  redFlagItem: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
  },
  themesBox: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  themesHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  themesTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  themeItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  themeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  themeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  globalUpdateBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  globalUpdateHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  globalUpdateLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  globalUpdateSub: {
    fontSize: 12.5,
    lineHeight: 17,
    fontFamily: "Inter_400Regular",
  },
  globalUpdateInput: {
    minHeight: 72,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  attachDivider: {
    height: 1,
    borderRadius: 1,
    marginVertical: 4,
  },
  attachLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  labCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  labInput: {
    flex: 1,
    minHeight: 56,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  cards: {
    gap: 12,
  },
  disclaimer: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    textAlign: "center",
    paddingTop: 8,
  },
  refineDock: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 14,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  refineDockText: {
    flex: 1,
    gap: 2,
  },
  refineDockTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  refineDockSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  refineButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  refineButtonText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
  },
});
