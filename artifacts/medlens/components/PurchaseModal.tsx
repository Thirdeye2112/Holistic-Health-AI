import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
  : "";

type Pack = {
  id: string;
  credits: number;
  priceUsd: number;
  label: string;
  description: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  getToken: () => Promise<string | null>;
  onPurchased?: () => void;
};

const PACKS: Pack[] = [
  { id: "pack_25", credits: 25, priceUsd: 499, label: "25 Credits", description: "25 Standard or ~8 Premium consults" },
  { id: "pack_100", credits: 100, priceUsd: 1499, label: "100 Credits", description: "100 Standard or ~33 Premium consults" },
  { id: "pack_300", credits: 300, priceUsd: 2999, label: "300 Credits", description: "300 Standard or 100 Premium consults" },
];

function formatPrice(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function PurchaseModal({ visible, onClose, getToken, onPurchased }: Props) {
  const colors = useColors();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleBuy = async (pack: Pack) => {
    setLoading(pack.id);
    setError(null);
    try {
      const token = await getToken();
      const origin = Platform.OS === "web" ? window.location.origin : `https://${process.env.EXPO_PUBLIC_DOMAIN ?? ""}`;
      const body = {
        packId: pack.id,
        successUrl: `${origin}/purchase-success`,
        cancelUrl: `${origin}/`,
      };

      const res = await fetch(`${API_BASE}/api/stripe/checkout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Checkout failed");
      }

      const { url } = (await res.json()) as { url: string };
      if (url) {
        await Linking.openURL(url);
        onPurchased?.();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed. Please try again.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: colors.card }]}>
        <View style={styles.dragHandle} />
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground }]}>Buy Credits</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Feather name="x" size={22} color={colors.mutedForeground} />
          </Pressable>
        </View>

        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Standard consults cost 1 credit · Premium (3 AI models) cost 3 credits
        </Text>

        {error ? (
          <View style={[styles.errorBox, { borderColor: colors.destructive, backgroundColor: `${colors.destructive}18` }]}>
            <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.packs}>
          {PACKS.map((pack) => (
            <Pressable
              key={pack.id}
              onPress={() => handleBuy(pack)}
              disabled={loading !== null}
              style={({ pressed }) => [
                styles.packCard,
                { borderColor: colors.border, backgroundColor: colors.background },
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.packLeft}>
                <Text style={[styles.packLabel, { color: colors.foreground }]}>{pack.label}</Text>
                <Text style={[styles.packDesc, { color: colors.mutedForeground }]}>{pack.description}</Text>
              </View>
              <View style={[styles.packRight, { backgroundColor: colors.primary }]}>
                {loading === pack.id ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={[styles.packPrice, { color: colors.primaryForeground }]}>
                    {formatPrice(pack.priceUsd)}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.fine, { color: colors.mutedForeground }]}>
          Secure checkout powered by Stripe. Credits are non-refundable.
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 16,
    paddingBottom: 40,
  },
  dragHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#E2E8F0",
    marginBottom: 4,
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
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
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
  packs: {
    gap: 10,
  },
  packCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  packLeft: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 3,
  },
  packLabel: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  packDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  packRight: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  packPrice: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  fine: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 16,
  },
});
