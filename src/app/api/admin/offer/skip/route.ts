import { requireAdmin } from "@/lib/admin";
import { isSlotId, readJson } from "@/lib/api";
import { getAdminSchedule, skipOffer } from "@/lib/db";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJson<{ slotId?: number }>(request);
  if (!isSlotId(body.slotId)) return Response.json({ error: "Falta la sesión." }, { status: 400 });
  const result = await skipOffer(body.slotId);
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json({ admin: true, ...(await getAdminSchedule()) });
}
