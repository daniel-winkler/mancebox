import { isValidName, isValidPhone, normalizePhone } from "./phone";

// Malformed or non-object bodies become {}, so the route's own validation answers with a 400 instead of a 500.
export async function readJson<T>(request: Request): Promise<Partial<T>> {
  try {
    const data: unknown = await request.json();
    return data && typeof data === "object" && !Array.isArray(data) ? (data as Partial<T>) : {};
  } catch {
    return {};
  }
}

export function isSlotId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

export function identityFrom(body: { name?: string; phone?: string }) {
  const name = String(body.name ?? "").trim();
  const phone = normalizePhone(String(body.phone ?? ""));
  if (!isValidName(name)) return { error: "Introduce un nombre válido." };
  if (!isValidPhone(phone)) return { error: "Introduce un teléfono válido (mínimo 9 dígitos)." };
  return { name, phone };
}

export function phoneFrom(body: { phone?: string }, search?: string | null) {
  const phone = normalizePhone(String(body.phone ?? search ?? ""));
  if (!isValidPhone(phone)) return { error: "Introduce un teléfono válido." };
  return { phone };
}
