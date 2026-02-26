import { verifyRefreshToken, signAccessToken } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get("refresh_token")?.value;
  if (!refreshToken) {
    return new Response(JSON.stringify({ error: "No refresh token" }), {
      status: 401,
    });
  }
  const payload = verifyRefreshToken(refreshToken);
  if (!payload) {
    return new Response(JSON.stringify({ error: "Invalid refresh token" }), {
      status: 401,
    });
  }
  const accessToken = signAccessToken(payload);
  return new Response(JSON.stringify({ accessToken }), { status: 200 });
}
