import { createHmac } from "crypto";
import { cookies } from "next/headers";

const COOKIE = "mancebox_admin";

// The "cross123" default is public (README), so it is only allowed outside production.
export function getAdminPassword(): string | null {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.env.NETLIFY || process.env.NODE_ENV === "production") return null;
  return "cross123";
}

function tokenFor(password: string): string {
  return createHmac("sha256", password).update("mancebox-admin").digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  const password = getAdminPassword();
  return password !== null && value === tokenFor(password);
}

export async function setAdminCookie(password: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, tokenFor(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearAdminCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function requireAdmin(): Promise<Response | null> {
  if (await isAdmin()) return null;
  return Response.json({ error: "No autorizado" }, { status: 401 });
}
