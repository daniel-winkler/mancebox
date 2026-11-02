import { getSchedule } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("phone") ?? "";
  const phone = normalizePhone(raw);
  const data = await getSchedule(phone.length >= 9 ? phone : null);
  return Response.json(data);
}
