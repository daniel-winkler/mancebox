import { identityFrom, isSlotId, readJson } from "@/lib/api";
import { joinSlot } from "@/lib/db";

export async function POST(request: Request) {
  const body = await readJson<{ slotId?: number; name?: string; phone?: string }>(request);
  const identity = identityFrom(body);
  if ("error" in identity) return Response.json(identity, { status: 400 });
  if (!isSlotId(body.slotId)) return Response.json({ error: "Falta la sesión." }, { status: 400 });

  try {
    const result = await joinSlot(body.slotId, identity.name, identity.phone);
    if ("error" in result) return Response.json(result, { status: 409 });
    return Response.json(result);
  } catch {
    return Response.json({ error: "No se pudo completar la reserva." }, { status: 500 });
  }
}
