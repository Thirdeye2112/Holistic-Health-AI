import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type {
  DisciplinePerspective,
  FollowupAnswer,
} from "@workspace/api-client-react";

type Props = {
  perspective: DisciplinePerspective;
  expanded: boolean;
  onToggle: () => void;
  draftAnswers: Record<string, string>;
  onAnswerChange: (question: string, answer: string) => void;
  justUpdated?: boolean;
  appliedAnswers?: FollowupAnswer[];
};

export function PerspectiveCard({
  perspective,
  expanded,
  onToggle,
  draftAnswers,
  onAnswerChange,
  justUpdated = false,
  appliedAnswers = [],
}: Props) {
  const colors = useColors();
  const accent = perspective.accent || colors.primary;
  const [evidenceOpen, setEvidenceOpen] = useState(false);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: justUpdated ? colors.primary : colors.border,
          shadowColor: "#000",
        },
        justUpdated && styles.cardUpdated,
      ]}
    >
      <Pressable
        onPress={() => {
          if (Platform.OS !== "web") {
            Haptics.selectionAsync().catch(() => {});
          }
          onToggle();
        }}
        style={({ pressed }) => [
          styles.header,
          pressed && Platform.OS !== "web" && { opacity: 0.85 },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.headerContent}>
          <View style={styles.nameRow}>
            <Text style={[styles.disciplineName, { color: colors.foreground }]}>
              {perspective.disciplineName}
            </Text>
            {justUpdated ? (
              <View
                style={[
                  styles.updatedBadge,
                  {
                    backgroundColor: `${colors.primary}1A`,
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.updatedDot,
                    { backgroundColor: colors.primary },
                  ]}
                />
                <Text
                  style={[styles.updatedText, { color: colors.primary }]}
                >
                  Updated
                </Text>
              </View>
            ) : null}
          </View>
          {expanded ? (
            <Text style={[styles.summary, { color: colors.mutedForeground }]}>
              {perspective.summary}
            </Text>
          ) : (
            <Text
              style={[styles.preview, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {perspective.diagnoses[0]?.condition
                ? `Top: ${perspective.diagnoses[0].condition}`
                : perspective.summary}
            </Text>
          )}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={colors.mutedForeground}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.body}>
          {appliedAnswers.length > 0 ? (
            <View
              style={[
                styles.contextBox,
                {
                  backgroundColor: `${colors.primary}0D`,
                  borderColor: `${colors.primary}40`,
                },
              ]}
            >
              <View style={styles.contextHead}>
                <Feather name="message-circle" size={13} color={colors.primary} />
                <Text
                  style={[styles.contextTitle, { color: colors.primary }]}
                >
                  Context you provided
                </Text>
              </View>
              {appliedAnswers.map((a, i) => (
                <View key={i} style={styles.contextItem}>
                  <Text
                    style={[styles.contextQ, { color: colors.foreground }]}
                  >
                    {a.question}
                  </Text>
                  <Text
                    style={[
                      styles.contextA,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {a.answer}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}

          <Section
            title="Differential diagnoses"
            icon="target"
            accent={accent}
            color={colors.foreground}
          >
            {perspective.diagnoses.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                No diagnoses produced.
              </Text>
            ) : (
              perspective.diagnoses.map((d, i) => (
                <View
                  key={i}
                  style={[
                    styles.diagnosis,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                >
                  <View style={styles.diagnosisHead}>
                    <Text
                      style={[styles.condition, { color: colors.foreground }]}
                    >
                      {d.condition}
                    </Text>
                    <LikelihoodBadge likelihood={d.likelihood} accent={accent} />
                  </View>
                  <Text
                    style={[
                      styles.rationale,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {d.rationale}
                  </Text>
                </View>
              ))
            )}
          </Section>

          <Section
            title="Adjacent issues"
            icon="link-2"
            accent={accent}
            color={colors.foreground}
          >
            <BulletList
              items={perspective.adjacentIssues}
              color={colors.foreground}
              mutedColor={colors.mutedForeground}
              accent={accent}
            />
          </Section>

          <Section
            title="Recommendations"
            icon="check-circle"
            accent={accent}
            color={colors.foreground}
          >
            <BulletList
              items={perspective.recommendations}
              color={colors.foreground}
              mutedColor={colors.mutedForeground}
              accent={accent}
            />
          </Section>

          {(perspective.recommendedTests ?? []).length > 0 ? (
            <Section
              title="Recommended tests"
              icon="activity"
              accent={accent}
              color={colors.foreground}
            >
              <View style={styles.testGrid}>
                {(perspective.recommendedTests ?? []).map((test, i) => (
                  <View
                    key={i}
                    style={[
                      styles.testChip,
                      { borderColor: accent + "55", backgroundColor: accent + "10" },
                    ]}
                  >
                    <Feather name="check" size={11} color={accent} />
                    <Text style={[styles.testChipText, { color: colors.foreground }]}>
                      {test}
                    </Text>
                  </View>
                ))}
              </View>
            </Section>
          ) : null}

          {perspective.evidenceNotes.length > 0 ? (
            <View style={styles.section}>
              <Pressable
                onPress={() => {
                  if (Platform.OS !== "web") {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  setEvidenceOpen((v) => !v);
                }}
                style={styles.sectionHead}
              >
                <Feather name="book-open" size={14} color={accent} />
                <Text style={[styles.sectionTitle, { color: colors.foreground, flex: 1 }]}>
                  Evidence notes
                </Text>
                <Feather
                  name={evidenceOpen ? "chevron-up" : "chevron-down"}
                  size={14}
                  color={colors.mutedForeground}
                />
              </Pressable>
              {evidenceOpen ? (
                <View style={styles.sectionBody}>
                  {perspective.evidenceNotes.map((note, i) => (
                    <Text
                      key={i}
                      style={[
                        styles.evidenceNote,
                        {
                          color: colors.mutedForeground,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {note}
                    </Text>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

          {perspective.followUpQuestions.length > 0 ? (
            <Section
              title="Follow-up questions"
              icon="help-circle"
              accent={accent}
              color={colors.foreground}
            >
              {perspective.followUpQuestions.map((q, i) => (
                <View
                  key={i}
                  style={[
                    styles.questionBlock,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[styles.questionText, { color: colors.foreground }]}
                  >
                    {q}
                  </Text>
                  <TextInput
                    value={draftAnswers[q] ?? ""}
                    onChangeText={(text) => onAnswerChange(q, text)}
                    placeholder="Your answer (optional)"
                    placeholderTextColor={colors.mutedForeground}
                    multiline
                    style={[
                      styles.questionInput,
                      {
                        color: colors.foreground,
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      },
                    ]}
                  />
                </View>
              ))}
            </Section>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Section({
  title,
  icon,
  accent,
  color,
  children,
}: {
  title: string;
  icon: keyof typeof Feather.glyphMap;
  accent: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Feather name={icon} size={14} color={accent} />
        <Text style={[styles.sectionTitle, { color }]}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function BulletList({
  items,
  color,
  mutedColor,
  accent,
}: {
  items: string[];
  color: string;
  mutedColor: string;
  accent: string;
}) {
  if (items.length === 0) {
    return (
      <Text style={[styles.emptyText, { color: mutedColor }]}>
        None noted.
      </Text>
    );
  }
  return (
    <View style={styles.list}>
      {items.map((item, i) => (
        <View key={i} style={styles.listItem}>
          <View style={[styles.bullet, { backgroundColor: accent }]} />
          <Text style={[styles.listText, { color }]}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function LikelihoodBadge({
  likelihood,
  accent,
}: {
  likelihood: string;
  accent: string;
}) {
  const normalized = likelihood.toLowerCase();
  return (
    <View
      style={[
        styles.likelihoodBadge,
        { borderColor: accent, backgroundColor: `${accent}1A` },
      ]}
    >
      <Text style={[styles.likelihoodText, { color: accent }]}>
        {normalized}
      </Text>
    </View>
  );
}

export function getDraftKey(disciplineId: string, question: string): string {
  return `${disciplineId}::${question}`;
}

export function buildAnswerPayload(
  perspectives: DisciplinePerspective[],
  drafts: Record<string, string>,
): FollowupAnswer[] {
  const out: FollowupAnswer[] = [];
  for (const p of perspectives) {
    for (const q of p.followUpQuestions) {
      const key = getDraftKey(p.disciplineId, q);
      const ans = (drafts[key] ?? "").trim();
      if (ans.length > 0) {
        out.push({
          disciplineId: p.disciplineId,
          question: q,
          answer: ans,
        });
      }
    }
  }
  return out;
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  cardUpdated: {
    borderWidth: 1.5,
    shadowOpacity: 0.07,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingRight: 16,
    gap: 12,
  },
  accentBar: {
    width: 5,
    alignSelf: "stretch",
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
  },
  headerContent: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  disciplineName: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  updatedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  updatedDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  updatedText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summary: {
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  preview: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 2,
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 18,
    gap: 18,
  },
  contextBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  contextHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  contextTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  contextItem: {
    gap: 3,
  },
  contextQ: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    lineHeight: 18,
  },
  contextA: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    fontStyle: "italic",
  },
  section: {
    gap: 10,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  sectionBody: {
    gap: 10,
  },
  diagnosis: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  diagnosisHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  condition: {
    flex: 1,
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  rationale: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
  },
  list: {
    gap: 8,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
  },
  listText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  likelihoodBadge: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  likelihoodText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  testGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  testChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  testChipText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  evidenceNote: {
    fontSize: 12.5,
    lineHeight: 18,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderLeftWidth: 2,
    fontFamily: "Inter_400Regular",
  },
  questionBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  questionText: {
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_500Medium",
  },
  questionInput: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
});
