import { NextResponse, type NextRequest } from "next/server";

const COOKIE = "mancebox_access";
const PARAM = "key";
const FORM_PATH = "/acceso";

function noIndex(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}

function matches(input: string | null, accessKey: string) {
  return (input ?? "").trim().toLowerCase() === accessKey.trim().toLowerCase();
}

function grant(accessKey: string, target: URL, status = 307) {
  const response = NextResponse.redirect(target, status);
  response.cookies.set(COOKIE, accessKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function accessPage(error: boolean) {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Mancebox</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100dvh; display: grid; place-items: center; padding: 16px;
    background: #f5f7f4; font: 15px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; color: #202a25; }
  .card { width: 100%; max-width: 380px; background: #fff; border: 1px solid #e1e7e1; border-radius: 20px;
    overflow: hidden; box-shadow: 0 8px 30px #15251b12; }
  .hero { background: #182b28; color: #fff; padding: 20px; font-weight: 800; letter-spacing: 1px; }
  .hero small { display: block; color: #c5d2ca; font-size: 12px; font-weight: 400; }
  form { padding: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  p { color: #68756e; font-size: 13px; margin: 0 0 14px; }
  input { width: 100%; padding: 11px; border: 1px solid #d8dfd8; border-radius: 9px; font: inherit; }
  button { width: 100%; margin-top: 10px; border: 0; border-radius: 9px; padding: 11px 14px;
    background: #182b28; color: #fff; font: inherit; font-weight: 650; cursor: pointer; }
  .password-field { position: relative; }
  .password-field input { padding-right: 44px; }
  .password-field button { position: absolute; top: 0; right: 0; bottom: 0; width: 44px; margin: 0; padding: 0;
    display: grid; place-items: center; background: none; color: #68756e; }
  .password-field button:not(.on) .slash { display: none; }
  .error { background: #f8e7e7; color: #a44747; padding: 9px 12px; border-radius: 9px; font-size: 13px; margin-bottom: 12px; }
</style>
</head>
<body>
  <main class="card">
    <div class="hero">MANCEBOX<small>COMUNIDAD DE ENTRENAMIENTO</small></div>
    <form method="post" action="${FORM_PATH}">
      <h1>Acceso</h1>
      <p>Introduce la clave de acceso que te ha pasado el organizador.</p>
      ${error ? '<div class="error">Clave incorrecta. Inténtalo de nuevo.</div>' : ""}
      <div class="password-field">
        <input id="clave" name="clave" type="password" autocomplete="off" aria-label="Clave de acceso" required autofocus />
        <button id="toggle" type="button" aria-label="Mostrar clave" aria-pressed="false">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" />
            <path class="slash" d="M3 3l18 18" />
          </svg>
        </button>
      </div>
      <button type="submit">Entrar</button>
    </form>
  </main>
  <script>
    document.getElementById("toggle").addEventListener("click", function () {
      var input = document.getElementById("clave");
      var show = input.type === "password";
      input.type = show ? "text" : "password";
      this.classList.toggle("on", show);
      this.setAttribute("aria-pressed", String(show));
      this.setAttribute("aria-label", show ? "Ocultar clave" : "Mostrar clave");
    });
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    status: error ? 401 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

// Access gate: when ACCESS_KEY is set, visitors must enter it once (or open a link with
// ?key=<ACCESS_KEY>). The key is then remembered in a cookie for a year.
export async function proxy(request: NextRequest) {
  const accessKey = process.env.ACCESS_KEY;
  if (!accessKey) return noIndex(NextResponse.next());

  const { pathname, searchParams } = request.nextUrl;

  if (pathname === FORM_PATH && request.method === "POST") {
    const form = await request.formData();
    if (matches(form.get("clave") as string | null, accessKey)) {
      return noIndex(grant(accessKey, new URL("/", request.url), 303));
    }
    return noIndex(accessPage(true));
  }

  if (searchParams.has(PARAM) && matches(searchParams.get(PARAM), accessKey)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete(PARAM);
    return noIndex(grant(accessKey, clean));
  }

  if (request.cookies.get(COOKIE)?.value === accessKey) {
    return noIndex(NextResponse.next());
  }

  if (pathname.startsWith("/api/")) {
    return noIndex(NextResponse.json({ error: "Acceso no autorizado." }, { status: 401 }));
  }
  return noIndex(accessPage(false));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
