# 360* to Health

An Expo mobile/web app (package/slug `medlens`/`tohealth`) that consults a panel of 10 medical and alternative health disciplines on any user-described ailment, returning per-discipline diagnoses, adjacent contributing issues, recommendations, evidence notes, and follow-up questions.

## Architecture

- **Frontend**: `artifacts/medlens` — Expo / React Native (expo-router, single main screen).
- **Backend**: `artifacts/api-server` — Express + OpenAPI; routes generated as typed clients via `@workspace/api-client-react`.
- **AI models**: OpenAI GPT-5.4, Anthropic Claude Opus, Google Gemini Pro — all via Replit AI Integrations proxies.
- **Auth**: Clerk (`@clerk/express` on API, `@clerk/expo` on mobile). Users get 10 free credits on signup.
- **DB**: Drizzle ORM + PostgreSQL (`@workspace/db`). Users table stores id, email, credits, stripe_customer_id.
- **Payments**: Stripe (credit packs). Requires `STRIPE_SECRET_KEY` secret to be configured.

## Analysis Modes

- **Standard** (1 credit): GPT-5.4 only — fastest analysis.
- **Premium** (3 credits): GPT-5.4 + Claude Opus + Gemini Pro, synthesised into one result per discipline.

## Credit System

- New users start with 10 free credits (created on first `POST /medlens/analyze` call).
- Standard consult = 1 credit; Premium consult = 3 credits.
- Credits are deducted **after** successful analysis.
- Credit packs available via Stripe checkout: 25 cr ($4.99), 100 cr ($14.99), 300 cr ($29.99).

## Disciplines (10)

Conventional, Functional, Naturopathic, TCM, Ayurveda, Chiropractic, Osteopathic, Clinical Nutrition, Mind-Body / Psychology, Homeopathy.

## API Endpoints

- `GET  /api/medlens/disciplines` — list disciplines with accent colors.
- `POST /api/medlens/analyze` — requires auth. Body: `{ ailment, age?, sex?, history?, followupAnswers?, mode? }`. Deducts credits, returns full multi-perspective AnalysisResult + creditsUsed + creditsRemaining.
- `GET  /api/stripe/balance` — returns `{ credits }` for signed-in user.
- `GET  /api/stripe/products` — lists available credit packs.
- `POST /api/stripe/checkout` — creates a Stripe checkout session. Body: `{ packId, successUrl, cancelUrl }`.
- `POST /api/stripe/webhook` — Stripe webhook (registered before express.json(), uses raw body).

## Key files

- `lib/api-spec/openapi.yaml` — API contract; codegen produces client (`lib/api-client-react`) + zod schemas (`lib/api-zod`).
- `lib/db/src/schema/users.ts` — users table (id, email, stripe_customer_id, credits).
- `artifacts/api-server/src/lib/storage.ts` — user DB operations (getOrCreateUser, deductCredits, addCredits).
- `artifacts/api-server/src/lib/stripeClient.ts` — Stripe client + CREDIT_PACKS constant.
- `artifacts/api-server/src/lib/webhookHandlers.ts` — Stripe webhook handler (adds credits on checkout.session.completed).
- `artifacts/api-server/src/routes/medlens.ts` — discipline definitions and analysis logic with credit check.
- `artifacts/api-server/src/routes/stripe.ts` — balance, products, checkout endpoints.
- `artifacts/medlens/context/AnalysisContext.tsx` — analysis state + AsyncStorage history.
- `artifacts/medlens/context/UserContext.tsx` — Clerk auth state, credit balance, setAuthTokenGetter.
- `artifacts/medlens/components/ConsultForm.tsx` — main form with mode toggle, auth prompt, credits display.
- `artifacts/medlens/components/AuthModal.tsx` — email/password sign-in and sign-up modal.
- `artifacts/medlens/components/PurchaseModal.tsx` — credit pack purchase via Stripe checkout.
- `artifacts/medlens/constants/colors.ts` — teal (#0F766E) primary, amber (#B45309) accent, Inter font family.

## Environment Variables Required

- `CLERK_SECRET_KEY` — Clerk backend API key (set by Clerk integration).
- `CLERK_PUBLISHABLE_KEY` — Clerk publishable key (set by Clerk integration).
- `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` — Clerk publishable key for Expo app (shared env var).
- `STRIPE_SECRET_KEY` — Stripe secret key (required for credit purchases; set it in Secrets tab).
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret (optional; prevents webhook spoofing).
- `DATABASE_URL` — PostgreSQL connection string (Replit DB).
- AI integration keys: `AI_INTEGRATIONS_OPENAI_*`, `AI_INTEGRATIONS_ANTHROPIC_*`, `AI_INTEGRATIONS_GEMINI_*`.
