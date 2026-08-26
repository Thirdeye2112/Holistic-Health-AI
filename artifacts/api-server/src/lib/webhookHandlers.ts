import type { Stripe } from "stripe";
import type { Request, Response } from "express";
import { getStripe, getCreditPack } from "./stripeClient";
import { addCredits, getUserByStripeCustomerId, setStripeCustomerId } from "./storage";
import { logger } from "./logger";

const WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";

export async function handleStripeWebhook(req: Request, res: Response): Promise<void> {
  const sig = req.headers["stripe-signature"];

  if (!sig || !WEBHOOK_SECRET) {
    res.status(400).json({ error: "Missing webhook signature or secret" });
    return;
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, WEBHOOK_SECRET);
  } catch (err) {
    logger.error({ err }, "Webhook signature verification failed");
    res.status(400).json({ error: "Invalid webhook signature" });
    return;
  }

  try {
    if (event.type === "checkout.session.completed") {
      await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
    }
    res.json({ received: true });
  } catch (err) {
    logger.error({ err, event: event.type }, "Webhook handler error");
    res.status(500).json({ error: "Webhook processing failed" });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.["userId"];
  const packId = session.metadata?.["packId"];

  if (!userId || !packId) {
    logger.warn({ session: session.id }, "Checkout session missing metadata");
    return;
  }

  const pack = getCreditPack(packId);
  if (!pack) {
    logger.warn({ packId }, "Unknown credit pack in checkout");
    return;
  }

  if (session.customer && typeof session.customer === "string") {
    const existing = await getUserByStripeCustomerId(session.customer);
    if (!existing) {
      await setStripeCustomerId(userId, session.customer);
    }
  }

  await addCredits(userId, pack.credits);
  logger.info({ userId, packId, credits: pack.credits }, "Credits added after purchase");
}
