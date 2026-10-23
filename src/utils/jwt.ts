import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "../generated/prisma/client.js";

interface AccessTokenPayload {
  userId: string;
  role: UserRole;
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return new TextEncoder().encode(secret);
}

export async function signAccessToken({
  userId,
  role,
}: AccessTokenPayload): Promise<string> {
  const secret = getJwtSecret();
  const expiresIn = process.env.JWT_EXPIRES_IN ?? "15m";

  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("gold-shop-api")
    .setAudience("gold-shop-client")
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const secret = getJwtSecret();

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer: "gold-shop-api",
      audience: "gold-shop-client",
    });

    if (
      typeof payload.sub !== "string" ||
      (payload.role !== "CUSTOMER" && payload.role !== "ADMIN")
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role: payload.role,
    };
  } catch {
    return null;
  }
}