import type { AdminSlot, PublicSlot, Room } from "./types";

export type SchedulePayload = {
  room: Room | null;
  slots: PublicSlot[];
};

export type AdminPayload = {
  admin: boolean;
  room?: Room | null;
  slots?: AdminSlot[];
  error?: string;
};

const jsonHeaders = { "Content-Type": "application/json" };

async function parse<T>(res: Promise<Response>): Promise<T> {
  const response = await res;
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Ha ocurrido un error.");
  return data;
}

export function fetchSchedule(phone: string) {
  const q = phone ? `?phone=${encodeURIComponent(phone)}` : "";
  return parse<SchedulePayload>(fetch(`/api/schedule${q}`, { cache: "no-store" }));
}

export function bookSlot(slotId: number, name: string, phone: string) {
  return parse(
    fetch("/api/book", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ slotId, name, phone }),
    }),
  );
}

export function cancelSlot(slotId: number, phone: string) {
  return parse(
    fetch("/api/cancel", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ slotId, phone }),
    }),
  );
}

export function acceptOffer(slotId: number, phone: string) {
  return parse(
    fetch("/api/offer/accept", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ slotId, phone }),
    }),
  );
}

export function declineOffer(slotId: number, phone: string) {
  return parse(
    fetch("/api/offer/decline", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ slotId, phone }),
    }),
  );
}

export function fetchAdminSession() {
  return parse<AdminPayload>(fetch("/api/admin/session", { cache: "no-store" }));
}

export function adminLogin(password: string) {
  return parse<AdminPayload>(
    fetch("/api/admin/login", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ password }),
    }),
  );
}

export function adminLogout() {
  return parse(fetch("/api/admin/logout", { method: "POST" }));
}

export function createRoom(title: string) {
  return parse<AdminPayload>(
    fetch("/api/admin/rooms", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ title }),
    }),
  );
}

export function createSlot(label: string, time: string, place: string, capacity: number) {
  return parse<AdminPayload>(
    fetch("/api/admin/slots", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ label, time, place, capacity }),
    }),
  );
}

export function skipOffer(slotId: number) {
  return parse<AdminPayload>(
    fetch("/api/admin/offer/skip", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ slotId }),
    }),
  );
}
