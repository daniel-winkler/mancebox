import { isAdmin } from "@/lib/admin";
import { getAdminSchedule } from "@/lib/db";

export async function GET() {
  if (!(await isAdmin())) return Response.json({ admin: false });
  const data = await getAdminSchedule();
  return Response.json({ admin: true, ...data });
}
