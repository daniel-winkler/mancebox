# Mancebox

Aplicación web sencilla para reservar plazas de clases de cross training. Sustituye las encuestas de WhatsApp: una sala activa (una semana), sesiones con cupo de 15 y lista de espera con oferta manual al primero de la cola.

## Cómo se usa

1. Abre la web y guarda **nombre y teléfono** (quedan en este dispositivo).
2. En **Horarios** reserva plaza o entra en lista de espera si la sesión está llena.
3. Si alguien cancela, el primero de la espera recibe una **oferta**. Tiene que aceptarla o rechazarla; si rechaza, pasa al siguiente. No hay caducidad automática.
4. El organizador entra en **Admin** con una contraseña, crea la sala de la semana y añade sesiones (día, hora y lugar). Comparte siempre la misma URL.

En local, si no configuras Turso, se usa un SQLite en `.data/mancebox.db`. La contraseña de admin por defecto es `cross123` (solo en local; en producción `ADMIN_PASSWORD` es obligatoria).

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Despliegue gratuito (Netlify + Turso)

1. Crea una base de datos en [Turso](https://turso.tech) (`turso db create mancebox`) y copia URL y token.
2. Sube el proyecto a GitHub e impórtalo en [Netlify](https://www.netlify.com) (plan gratuito). Netlify detecta Next.js y usa la configuración de `netlify.toml`.
3. En Netlify (*Site configuration → Environment variables*), añade las variables:

   - `TURSO_DATABASE_URL`
   - `TURSO_AUTH_TOKEN`
   - `ADMIN_PASSWORD` (obligatoria: sin ella el acceso de administrador queda desactivado)

4. Las tablas se crean solas al primer uso. Comparte la URL de Netlify por WhatsApp.

En producción Turso es obligatorio: el sistema de archivos de Netlify es de solo lectura, así que el SQLite local no funciona allí.
