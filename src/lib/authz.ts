import { verifyAccessToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/lib/roles";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
  admin: boolean;
  doctorId: number | null;
};

const LAST_ONLINE_UPDATE_INTERVAL_MS = 15 * 1000;

export async function getUserFromAuthHeader(
  authHeader: string | null,
): Promise<AuthUser | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const payload = verifyAccessToken(token);
  if (!payload) return null;

  const user = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      admin: users.admin,
      doctorId: users.doctorId,
      lastOnlineAt: users.lastOnlineAt,
    })
    .from(users)
    .where(eq(users.id, payload.id))
    .get();

  if (!user) return null;

  const shouldUpdateLastOnlineAt =
    !user.lastOnlineAt ||
    Date.now() - new Date(user.lastOnlineAt).getTime() >=
      LAST_ONLINE_UPDATE_INTERVAL_MS;

  if (shouldUpdateLastOnlineAt) {
    await db
      .update(users)
      .set({ lastOnlineAt: new Date() })
      .where(eq(users.id, user.id));
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    admin: user.admin,
    doctorId: user.doctorId,
  };
}
