import { phoneFrom, readJson } from "@/lib/api";
import { acceptOffer } from "@/lib/db";

export async function POST(request: Request) {
  const body = await readJson<{ slotId?: number; phone?: string }>(request);
  const id = phoneFrom(body);
  if ("error" in id) return Response.json(id, { status: 400 });
  if (!body.slotId) return Response.json({ error: "Falta la sesión." }, { status: 400 });

  const result = await acceptOffer(body.slotId, id.phone);
  if ("error" in result) return Response.json(result, { status: 409 });
  return Response.json(result);
}
