import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not configured. Please connect the Stripe integration.");
    }
    _stripe = new Stripe(key, { apiVersion: "2025-02-24.acacia" });
  }
  return _stripe;
}

export const CREDIT_PACKS = [
  { id: "pack_25", credits: 25, priceUsd: 499, label: "25 Credits", description: "25 Standard consults or ~8 Premium consults" },
  { id: "pack_100", credits: 100, priceUsd: 1499, label: "100 Credits", description: "100 Standard consults or ~33 Premium consults" },
  { id: "pack_300", credits: 300, priceUsd: 2999, label: "300 Credits", description: "300 Standard consults or 100 Premium consults" },
] as const;

export type CreditPackId = (typeof CREDIT_PACKS)[number]["id"];

export function getCreditPack(id: string) {
  return CREDIT_PACKS.find((p) => p.id === id) ?? null;
}
