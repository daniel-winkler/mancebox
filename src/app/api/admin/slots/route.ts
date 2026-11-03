import { requireAdmin } from "@/lib/admin";
import { readJson } from "@/lib/api";
import { addSlot, getAdminSchedule } from "@/lib/db";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJson<{ label?: string; time?: string; place?: string; capacity?: number }>(request);
  const label = String(body.label ?? "").trim();
  const time = String(body.time ?? "").trim();
  const place = String(body.place ?? "").trim();
  const capacity = Number(body.capacity);
  if (!label || !time || !place) {
    return Response.json({ error: "Indica día, hora y lugar." }, { status: 400 });
  }
  if (label.length > 60 || time.length > 60 || place.length > 60) {
    return Response.json({ error: "Día, hora y lugar no pueden superar 60 caracteres." }, { status: 400 });
  }
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 100) {
    return Response.json({ error: "Las plazas deben ser un número entre 1 y 100." }, { status: 400 });
  }
  const result = await addSlot(label, time, place, capacity);
  if ("error" in result) return Response.json(result, { status: 400 });
  return Response.json({ admin: true, ...(await getAdminSchedule()) });
}
