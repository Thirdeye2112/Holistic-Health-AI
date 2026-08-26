import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useColorScheme } from "react-native";

import { ConsultForm } from "@/components/ConsultForm";
import { ResultsView } from "@/components/ResultsView";
import { useAnalysis } from "@/context/AnalysisContext";
import { useColors } from "@/hooks/useColors";

export default function HomeScreen() {
  const colors = useColors();
  const scheme = useColorScheme();
  const { current, status, clearCurrent } = useAnalysis();

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {current ? (
        <ResultsView
          entry={current}
          loadingRefine={status === "loading"}
          onClose={clearCurrent}
        />
      ) : (
        <ConsultForm />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
