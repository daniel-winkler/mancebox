export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function isValidPhone(phone: string): boolean {
  return phone.length >= 9 && phone.length <= 15;
}

export function isValidName(name: string): boolean {
  const length = name.trim().length;
  return length >= 2 && length <= 60;
}
