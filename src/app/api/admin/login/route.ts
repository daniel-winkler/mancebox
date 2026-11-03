import { getAdminPassword, safeEqual, setAdminCookie } from "@/lib/admin";
import { getAdminSchedule } from "@/lib/db";
import { readJson } from "@/lib/api";

export async function POST(request: Request) {
  const password = getAdminPassword();
  if (password === null) {
    return Response.json(
      { error: "El acceso de administrador no está configurado (falta ADMIN_PASSWORD)." },
      { status: 503 },
    );
  }
  const body = await readJson<{ password?: string }>(request);
  if (typeof body.password !== "string" || !safeEqual(body.password, password)) {
    return Response.json({ error: "Contraseña incorrecta." }, { status: 401 });
  }
  await setAdminCookie(password);
  const data = await getAdminSchedule();
  return Response.json({ admin: true, ...data });
}
