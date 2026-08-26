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

export type BodyAreaKey = "head" | "body" | "armsLegs" | "digestion" | "medications";

export type BodyAreaState = {
  selected: string[];
  notes: string;
};

export type BodyAreasValue = Record<BodyAreaKey, BodyAreaState>;

export function emptyBodyAreas(): BodyAreasValue {
  return {
    head: { selected: [], notes: "" },
    body: { selected: [], notes: "" },
    armsLegs: { selected: [], notes: "" },
    digestion: { selected: [], notes: "" },
    medications: { selected: [], notes: "" },
  };
}

export function compileBodyContext(areas: BodyAreasValue): string {
  const parts: string[] = [];

  const sectionMeta: {
    key: BodyAreaKey;
    label: string;
    isMeds?: boolean;
  }[] = [
    { key: "head", label: "Head / neurological symptoms" },
    { key: "body", label: "Body / torso symptoms" },
    { key: "armsLegs", label: "Arms & legs symptoms" },
    { key: "digestion", label: "Digestive symptoms" },
    { key: "medications", label: "Medications & supplements", isMeds: true },
  ];

  for (const { key, label, isMeds } of sectionMeta) {
    const area = areas[key];
    const lines: string[] = [];

    if (!isMeds && area.selected.length > 0) {
      lines.push(area.selected.join(", "));
    }
    if (area.notes.trim()) {
      lines.push(area.notes.trim());
    }

    if (lines.length > 0) {
      parts.push(`${label}: ${lines.join("; ")}`);
    }
  }

  return parts.join("\n");
}

type AreaConfig = {
  key: BodyAreaKey;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  symptoms?: string[];
  notesPlaceholder: string;
};

const AREAS: AreaConfig[] = [
  {
    key: "head",
    label: "Head",
    icon: "circle",
    symptoms: [
      "Headache",
      "Migraine",
      "Dizziness",
      "Brain fog",
      "Blurred vision",
      "Eye strain",
      "Ringing in ears",
      "Ear pain",
      "Sinus pressure",
      "Jaw / TMJ pain",
      "Facial numbness",
      "Memory issues",
    ],
    notesPlaceholder: "Any other head, eye, or neurological details…",
  },
  {
    key: "body",
    label: "Body",
    icon: "user",
    symptoms: [
      "Fatigue",
      "Chest pain",
      "Shortness of breath",
      "Heart palpitations",
      "Back pain",
      "Neck stiffness",
      "Shoulder pain",
      "Hip pain",
      "Rib / side pain",
      "Night sweats",
      "Swollen lymph nodes",
      "Skin rash",
    ],
    notesPlaceholder: "Any other chest, back, or general body details…",
  },
  {
    key: "armsLegs",
    label: "Arms / Legs",
    icon: "activity",
    symptoms: [
      "Joint pain",
      "Weakness",
      "Numbness",
      "Tingling",
      "Swelling",
      "Muscle cramps",
      "Restless legs",
      "Knee pain",
      "Ankle pain",
      "Wrist / hand pain",
      "Foot pain",
      "Poor circulation",
    ],
    notesPlaceholder: "Any other arm, leg, or joint details…",
  },
  {
    key: "digestion",
    label: "Digestion",
    icon: "zap",
    symptoms: [
      "Bloating",
      "Nausea",
      "Heartburn / reflux",
      "Constipation",
      "Diarrhea",
      "Stomach cramps",
      "Excessive gas",
      "Loss of appetite",
      "Food sensitivities",
      "IBS symptoms",
      "Vomiting",
      "Blood in stool",
    ],
    notesPlaceholder: "Any other digestive or bowel details…",
  },
  {
    key: "medications",
    label: "Medications",
    icon: "plus-square",
    notesPlaceholder:
      "List current medications, supplements, vitamins, or herbs (e.g., Metformin 500mg, Vitamin D 2000IU, Ashwagandha)…",
  },
];

type Props = {
  value: BodyAreasValue;
  onChange: (next: BodyAreasValue) => void;
  disabled?: boolean;
};

export function BodyAreaSelector({ value, onChange, disabled = false }: Props) {
  const colors = useColors();
  const [openKey, setOpenKey] = useState<BodyAreaKey | null>(null);

  const toggle = (key: BodyAreaKey) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    setOpenKey((prev) => (prev === key ? null : key));
  };

  const toggleSymptom = (key: BodyAreaKey, symptom: string) => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    const prev = value[key].selected;
    const next = prev.includes(symptom)
      ? prev.filter((s) => s !== symptom)
      : [...prev, symptom];
    onChange({ ...value, [key]: { ...value[key], selected: next } });
  };

  const setNotes = (key: BodyAreaKey, notes: string) => {
    onChange({ ...value, [key]: { ...value[key], notes } });
  };

  const hasContent = (key: BodyAreaKey) =>
    value[key].selected.length > 0 || value[key].notes.trim().length > 0;

  return (
    <View style={styles.root}>
      <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
        Additional details by area
      </Text>

      <View style={styles.tabRow}>
        {AREAS.map((area) => {
          const isOpen = openKey === area.key;
          const filled = hasContent(area.key);
          return (
            <Pressable
              key={area.key}
              onPress={() => toggle(area.key)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.tab,
                {
                  backgroundColor:
                    isOpen
                      ? colors.primary
                      : filled
                        ? `${colors.primary}18`
                        : colors.card,
                  borderColor:
                    isOpen
                      ? colors.primary
                      : filled
                        ? colors.primary
                        : colors.border,
                },
                pressed && Platform.OS !== "web" && { opacity: 0.8 },
              ]}
            >
              <Feather
                name={area.icon}
                size={13}
                color={
                  isOpen
                    ? colors.primaryForeground
                    : filled
                      ? colors.primary
                      : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color:
                      isOpen
                        ? colors.primaryForeground
                        : filled
                          ? colors.primary
                          : colors.foreground,
                  },
                ]}
              >
                {area.label}
              </Text>
              {filled && !isOpen ? (
                <View
                  style={[styles.filledDot, { backgroundColor: colors.primary }]}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {AREAS.map((area) => {
        if (openKey !== area.key) return null;
        return (
          <View
            key={area.key}
            style={[
              styles.panel,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            {area.symptoms && area.symptoms.length > 0 ? (
              <>
                <Text
                  style={[styles.panelHint, { color: colors.mutedForeground }]}
                >
                  Tap any that apply
                </Text>
                <View style={styles.chipGrid}>
                  {area.symptoms.map((symptom) => {
                    const selected = value[area.key].selected.includes(symptom);
                    return (
                      <Pressable
                        key={symptom}
                        onPress={() => toggleSymptom(area.key, symptom)}
                        disabled={disabled}
                        style={({ pressed }) => [
                          styles.chip,
                          {
                            backgroundColor: selected
                              ? colors.primary
                              : colors.surfaceMuted,
                            borderColor: selected
                              ? colors.primary
                              : colors.border,
                          },
                          pressed && Platform.OS !== "web" && { opacity: 0.8 },
                        ]}
                      >
                        {selected ? (
                          <Feather
                            name="check"
                            size={11}
                            color={colors.primaryForeground}
                          />
                        ) : null}
                        <Text
                          style={[
                            styles.chipLabel,
                            {
                              color: selected
                                ? colors.primaryForeground
                                : colors.foreground,
                            },
                          ]}
                        >
                          {symptom}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <TextInput
              value={value[area.key].notes}
              onChangeText={(text) => setNotes(area.key, text)}
              placeholder={area.notesPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              multiline
              editable={!disabled}
              style={[
                styles.notes,
                {
                  color: colors.foreground,
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            />

            {value[area.key].selected.length > 0 ? (
              <Pressable
                onPress={() =>
                  onChange({
                    ...value,
                    [area.key]: { ...value[area.key], selected: [] },
                  })
                }
                style={styles.clearRow}
              >
                <Text
                  style={[styles.clearText, { color: colors.mutedForeground }]}
                >
                  Clear selections
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 1.1,
  },
  tabRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  filledDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  panelHint: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  notes: {
    minHeight: 60,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    textAlignVertical: "top",
  },
  clearRow: {
    alignSelf: "flex-start",
  },
  clearText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textDecorationLine: "underline",
  },
});
