import jwt, { JwtPayload } from "jsonwebtoken";

export type JwtUserPayload = {
  id: number;
  email: string;
};

const ACCESS_TOKEN_TTL_SEC = 60 * 15; // 15 minutes
const REFRESH_TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.NEXT_PUBLIC_JWT_SECRET;
  if (!secret) {
    // Use a dev fallback to avoid crashes in local
    return "dev-insecure-jwt-secret-change-me";
  }
  return secret;
}

export function signAccessToken(user: JwtUserPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(
    { sub: String(user.id), email: user.email, type: "access" },
    secret,
    {
      expiresIn: ACCESS_TOKEN_TTL_SEC,
    },
  );
}

export function signRefreshToken(user: JwtUserPayload): string {
  const secret = getJwtSecret();
  return jwt.sign(
    { sub: String(user.id), email: user.email, type: "refresh" },
    secret,
    {
      expiresIn: REFRESH_TOKEN_TTL_SEC,
    },
  );
}

export function verifyAccessToken(token: string): JwtUserPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload & {
      type?: string;
    };
    if (decoded.type !== "access") return null;
    return { id: Number(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): JwtUserPayload | null {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload & {
      type?: string;
    };
    if (decoded.type !== "refresh") return null;
    return { id: Number(decoded.sub), email: String(decoded.email) };
  } catch {
    return null;
  }
}

export const ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_SEC;
export const REFRESH_TOKEN_TTL_SECONDS = REFRESH_TOKEN_TTL_SEC;
