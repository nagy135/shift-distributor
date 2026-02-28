import { verifyAccessToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { UserRole } from "@/lib/roles";

export type AuthUser = {
  id: number;
  email: string;
  role: UserRole;
  doctorId: number | null;
};

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
      doctorId: users.doctorId,
    })
    .from(users)
    .where(eq(users.id, payload.id))
    .get();

  if (!user) return null;
  return user;
}
