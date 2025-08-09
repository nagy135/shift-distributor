import { headers } from "next/headers";
import { verifyAccessToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const headerList = await headers();
  const authHeader = headerList.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const payload = verifyAccessToken(token);
  if (!payload) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const user = await db.select().from(users).where(eq(users.id, payload.id)).get();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
  return new Response(JSON.stringify({ id: user.id, email: user.email }), { status: 200 });
}


