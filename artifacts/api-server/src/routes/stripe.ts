import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getOrCreateUser, getCredits, setStripeCustomerId, getUserByStripeCustomerId } from "../lib/storage";
import { getStripe, CREDIT_PACKS } from "../lib/stripeClient";

const router = Router();

router.get("/stripe/products", (_req, res) => {
  res.json({
    packs: CREDIT_PACKS.map((p) => ({
      id: p.id,
      credits: p.credits,
      priceUsd: p.priceUsd,
      label: p.label,
      description: p.description,
    })),
  });
});

router.get("/stripe/balance", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  try {
    const user = await getOrCreateUser(userId);
    res.json({ credits: user.credits });
  } catch (err) {
    req.log.error({ err }, "Failed to get balance");
    res.status(500).json({ error: "Failed to retrieve balance" });
  }
});

router.post("/stripe/checkout", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { packId, successUrl, cancelUrl } = req.body as {
    packId: string;
    successUrl: string;
    cancelUrl: string;
  };

  const pack = CREDIT_PACKS.find((p) => p.id === packId);
  if (!pack) {
    res.status(400).json({ error: "Invalid pack ID" });
    return;
  }

  if (!successUrl || !cancelUrl) {
    res.status(400).json({ error: "successUrl and cancelUrl are required" });
    return;
  }

  try {
    const stripe = getStripe();
    const user = await getOrCreateUser(userId);

    let customerId = user.stripeCustomerId ?? undefined;
    if (!customerId) {
      const existingByEmail = user.email
        ? await stripe.customers.list({ email: user.email, limit: 1 })
        : null;
      if (existingByEmail?.data[0]) {
        customerId = existingByEmail.data[0].id;
        await setStripeCustomerId(userId, customerId);
      }
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      customer_creation: customerId ? undefined : "always",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceUsd,
            product_data: {
              name: `360* to Health — ${pack.label}`,
              description: pack.description,
            },
          },
        },
      ],
      metadata: { userId, packId },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (session.customer && typeof session.customer === "string" && !user.stripeCustomerId) {
      await setStripeCustomerId(userId, session.customer);
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    req.log.error({ err }, "Stripe checkout creation failed");
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

export default router;
