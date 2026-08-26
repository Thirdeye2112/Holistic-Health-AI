import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback } from "react";
import {
  Alert,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

export type ImageAttachment = {
  base64: string;
  mimeType: string;
  uri: string;
};

type Props = {
  value: ImageAttachment | null;
  onChange: (attachment: ImageAttachment | null) => void;
  disabled?: boolean;
};

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  allowsEditing: false,
  quality: 0.75,
  base64: true,
  exif: false,
};

export function ImageAttachmentPicker({ value, onChange, disabled }: Props) {
  const colors = useColors();

  const handleResult = useCallback(
    (result: ImagePicker.ImagePickerResult) => {
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset || !asset.base64) return;
      const mimeType =
        asset.mimeType ?? (asset.uri.endsWith(".png") ? "image/png" : "image/jpeg");
      onChange({ base64: asset.base64, mimeType, uri: asset.uri });
    },
    [onChange],
  );

  const openCamera = useCallback(async () => {
    if (Platform.OS === "web") {
      openGallery();
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Camera access needed",
        "Please allow camera access in Settings to take a photo.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    handleResult(result);
  }, [handleResult]);

  const openGallery = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Photo library access needed",
        "Please allow photo access in Settings to choose a picture.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    handleResult(result);
  }, [handleResult]);

  if (value) {
    return (
      <View style={[styles.previewRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Image source={{ uri: value.uri }} style={styles.thumbnail} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={[styles.previewLabel, { color: colors.foreground }]}>Image attached</Text>
          <Text style={[styles.previewSub, { color: colors.mutedForeground }]}>
            The panel will visually examine this image alongside your description.
          </Text>
        </View>
        <Pressable
          onPress={() => onChange(null)}
          disabled={disabled}
          hitSlop={10}
          style={({ pressed }) => [
            styles.removeBtn,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Feather name="x" size={14} color={colors.mutedForeground} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.buttonRow}>
      {Platform.OS !== "web" && (
        <Pressable
          onPress={openCamera}
          disabled={disabled}
          style={({ pressed }) => [
            styles.attachBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
            pressed && { opacity: 0.75 },
          ]}
        >
          <Feather name="camera" size={15} color={colors.primary} />
          <Text style={[styles.attachBtnText, { color: colors.foreground }]}>Camera</Text>
        </Pressable>
      )}
      <Pressable
        onPress={openGallery}
        disabled={disabled}
        style={({ pressed }) => [
          styles.attachBtn,
          { backgroundColor: colors.card, borderColor: colors.border },
          pressed && { opacity: 0.75 },
        ]}
      >
        <Feather name="image" size={15} color={colors.primary} />
        <Text style={[styles.attachBtnText, { color: colors.foreground }]}>
          {Platform.OS === "web" ? "Attach image" : "Gallery"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    gap: 8,
  },
  attachBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  attachBtnText: {
    fontSize: 13.5,
    fontFamily: "Inter_500Medium",
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: "#eee",
  },
  previewLabel: {
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  previewSub: {
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    lineHeight: 16,
  },
  removeBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
