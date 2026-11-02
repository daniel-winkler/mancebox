import { requireAdmin } from "@/lib/admin";
import { readJson } from "@/lib/api";
import { createRoom, getAdminSchedule } from "@/lib/db";

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await readJson<{ title?: string }>(request);
  const title = (body.title ?? "").trim();
  if (title.length < 3) {
    return Response.json({ error: "Indica un nombre para la sala (por ejemplo, la semana)." }, { status: 400 });
  }
  await createRoom(title);
  return Response.json({ admin: true, ...(await getAdminSchedule()) });
}
