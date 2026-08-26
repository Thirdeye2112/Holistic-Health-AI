import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export type User = typeof usersTable.$inferSelect;

export async function getOrCreateUser(
  userId: string,
  email?: string | null,
): Promise<User> {
  const existing = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (existing.length > 0) {
    return existing[0]!;
  }

  const created = await db
    .insert(usersTable)
    .values({ id: userId, email: email ?? null, credits: 10 })
    .returning();

  return created[0]!;
}

export async function getCredits(userId: string): Promise<number> {
  const rows = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  return rows[0]?.credits ?? 0;
}

export async function deductCredits(
  userId: string,
  amount: number,
): Promise<{ credits: number }> {
  const rows = await db
    .select({ credits: usersTable.credits })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  const current = rows[0]?.credits ?? 0;
  if (current < amount) {
    throw new Error("Insufficient credits");
  }

  const updated = await db
    .update(usersTable)
    .set({ credits: sql`${usersTable.credits} - ${amount}` })
    .where(eq(usersTable.id, userId))
    .returning({ credits: usersTable.credits });

  return { credits: updated[0]?.credits ?? 0 };
}

export async function addCredits(
  userId: string,
  amount: number,
): Promise<{ credits: number }> {
  const updated = await db
    .update(usersTable)
    .set({ credits: sql`${usersTable.credits} + ${amount}` })
    .where(eq(usersTable.id, userId))
    .returning({ credits: usersTable.credits });

  return { credits: updated[0]?.credits ?? 0 };
}

export async function setStripeCustomerId(
  userId: string,
  stripeCustomerId: string,
): Promise<void> {
  await db
    .update(usersTable)
    .set({ stripeCustomerId })
    .where(eq(usersTable.id, userId));
}

export async function getUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<User | null> {
  const rows = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.stripeCustomerId, stripeCustomerId));
  return rows[0] ?? null;
}
