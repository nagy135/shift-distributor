import {
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const refreshTokenValue = cookieStore.get("refresh_token")?.value;
  if (!refreshTokenValue) {
    return new Response(JSON.stringify({ error: "No refresh token" }), {
      status: 401,
    });
  }
  const payload = verifyRefreshToken(refreshTokenValue);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid refresh token" }), {
      status: 401,
    });
  }

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);
  cookieStore.set("refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REFRESH_TOKEN_TTL_SECONDS,
  });

  return new Response(JSON.stringify({ accessToken }), { status: 200 });
}
