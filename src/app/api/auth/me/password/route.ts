import { NextRequest } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getUserFromAuthHeader } from "@/lib/authz";

export async function PATCH(req: NextRequest) {
  const headerList = await headers();
  const authUser = await getUserFromAuthHeader(headerList.get("authorization"));
  if (!authUser) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
    });
  }

  const currentPassword = String((body as Record<string, unknown>).currentPassword ?? "");
  const newPassword = String((body as Record<string, unknown>).newPassword ?? "");

  if (!currentPassword || !newPassword) {
    return new Response(
      JSON.stringify({ error: "Aktuelles und neues Passwort sind erforderlich" }),
      { status: 400 },
    );
  }

  if (newPassword.length < 8) {
    return new Response(
      JSON.stringify({ error: "Das neue Passwort muss mindestens 8 Zeichen lang sein" }),
      { status: 400 },
    );
  }

  const user = await db
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, authUser.id))
    .get();

  if (!user) {
    return new Response(JSON.stringify({ error: "Benutzer nicht gefunden" }), {
      status: 404,
    });
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!passwordMatches) {
    return new Response(
      JSON.stringify({ error: "Das aktuelle Passwort ist falsch" }),
      { status: 400 },
    );
  }

  const newPasswordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(users)
    .set({ passwordHash: newPasswordHash })
    .where(eq(users.id, user.id));

  return new Response(JSON.stringify({ success: true }), { status: 200 });
}
