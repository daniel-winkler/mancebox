import { isValidName, isValidPhone, normalizePhone } from "./phone";

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function identityFrom(body: { name?: string; phone?: string }) {
  const name = (body.name ?? "").trim();
  const phone = normalizePhone(body.phone ?? "");
  if (!isValidName(name)) return { error: "Introduce un nombre válido." };
  if (!isValidPhone(phone)) return { error: "Introduce un teléfono válido (mínimo 9 dígitos)." };
  return { name, phone };
}

export function phoneFrom(body: { phone?: string }, search?: string | null) {
  const phone = normalizePhone(body.phone ?? search ?? "");
  if (!isValidPhone(phone)) return { error: "Introduce un teléfono válido." };
  return { phone };
}
