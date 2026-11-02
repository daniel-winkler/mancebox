# Mancebox

Aplicación web sencilla para reservar plazas de clases de cross training. Sustituye las encuestas de WhatsApp: un plan activo (una semana), sesiones con cupo de 15 y lista de espera con oferta manual al primero de la cola.

## Cómo se usa

1. Abre la web (si se pide, introduce la **clave de acceso** que te ha pasado el organizador) y en **Perfil** guarda **nombre y teléfono** (quedan en este dispositivo). El teléfono es tu identificador: escríbelo siempre igual en todos tus dispositivos.
2. En **Horarios** reserva plaza o entra en lista de espera si la sesión está llena. Cada sesión permite ver la lista de participantes y la lista de espera. En **Mis reservas** tienes tus plazas, esperas y ofertas.
3. Si alguien cancela, el primero de la espera recibe una **oferta**. Tiene que aceptarla o rechazarla; si rechaza, pasa al siguiente. No hay caducidad automática: si alguien no responde, el organizador puede pasar la oferta al siguiente.
4. El organizador pulsa **⚙ Organizador** (arriba a la derecha), entra con su contraseña, crea el plan de la semana y añade sesiones (día, hora y lugar). Crear un plan nuevo reemplaza al actual (se pide confirmación). Comparte siempre la misma URL.

En local, si no configuras Turso, se usa un SQLite en `.data/mancebox.db`. La contraseña de admin por defecto es `cross123` (solo en local; en producción `ADMIN_PASSWORD` es obligatoria). Para probar la pantalla de clave de acceso en local, define `ACCESS_KEY` en `.env.local` y reinicia `npm run dev`; sin ella la web queda abierta.

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue gratuito (Netlify + Turso)

1. Crea una base de datos en [Turso](https://turso.tech) desde su panel web (o con `turso db create mancebox`; la CLI no funciona de forma nativa en Windows) y copia la URL y un token de lectura/escritura.
2. Sube el proyecto a GitHub e impórtalo en [Netlify](https://www.netlify.com) (plan gratuito). Netlify detecta Next.js y usa la configuración de `netlify.toml`.
3. En Netlify (*Site configuration → Environment variables*), añade las variables:

   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `ADMIN_PASSWORD` (obligatoria: sin ella el acceso de administrador queda desactivado). No uses `cross123`: es pública y el escáner de secretos de Netlify hará fallar el build.
   - `ACCESS_KEY` (opcional, recomendada): la clave de acceso general. Si está definida, la primera vez que alguien abre la web se le pide la clave (no distingue mayúsculas ni espacios); el navegador la recuerda durante un año. Sin ella, la web no muestra nada.

4. Las tablas se crean solas al primer uso. Comparte por WhatsApp la URL de Netlify y la clave de acceso. Si la clave se filtra, cámbiala en Netlify y vuelve a desplegar: todos tendrán que introducir la nueva. (También funciona un enlace directo `https://<tu-sitio>.netlify.app/?key=<ACCESS_KEY>`, que entra sin pedir la clave.)

La web indica a los buscadores que no la indexen (`noindex`).

En producción Turso es obligatorio: el sistema de archivos de Netlify es de solo lectura, así que el SQLite local no funciona allí.
