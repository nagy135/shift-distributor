import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { DEFAULT_USER_ROLE } from "@/lib/roles";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || "")
      .trim()
      .toLowerCase();
    const password = String(body.password || "");
    if (!email || !password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Invalid email or password" }),
        { status: 400 },
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get();
    if (existing) {
      return new Response(
        JSON.stringify({ error: "Email already registered" }),
        { status: 409 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const inserted = await db
      .insert(users)
      .values({ email, passwordHash, role: DEFAULT_USER_ROLE })
      .returning()
      .get();

    return new Response(
      JSON.stringify({
        id: inserted.id,
        email: inserted.email,
        role: inserted.role,
        createdAt: inserted.createdAt,
      }),
      { status: 201 },
    );
  } catch (e) {
    console.log("================\n", "e: ", e, "\n================");
    return new Response(JSON.stringify({ error: "Failed to register" }), {
      status: 500,
    });
  }
}
