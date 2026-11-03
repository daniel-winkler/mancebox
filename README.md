# Mancebox

Aplicación web sencilla para reservar plazas en clases de cross training, en lugar de las encuestas de WhatsApp. Hay un plan activo (una semana) con sesiones de cupo limitado y lista de espera.

## Cómo se usa

1. Abre la web, introduce la **clave de acceso** si se pide y guarda tu **nombre y teléfono** en **Perfil**. El teléfono te identifica: escríbelo siempre igual.
2. En **Horarios**, reserva plaza o apúntate a la lista de espera. En **Mis reservas** ves tus plazas, esperas y ofertas.
3. Si alguien cancela, el primero de la lista de espera recibe una **oferta** y debe aceptarla o rechazarla. El organizador puede pasar la oferta al siguiente si nadie responde.
4. El organizador entra con **⚙ Organizador**, crea el plan de la semana y añade sesiones (día, hora, lugar y plazas).

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000). En local, los datos se guardan en un SQLite en `.data/mancebox.db` y la contraseña de organizador por defecto es `cross123`.

## Configuración

Variables de entorno (ver `.env.example`):

| Variable | Descripción |
|---|---|
| `DATABASE_URL`, `DATABASE_AUTH_TOKEN` | URL y token de una base de datos libSQL remota. Obligatorias en producción. |
| `ADMIN_PASSWORD` | Contraseña del organizador. Obligatoria en producción; usa una larga y aleatoria. |
| `ACCESS_KEY` | Opcional (recomendada). Clave para entrar en la web; el navegador la recuerda un año. Un enlace con `?key=<clave>` entra directamente. Sin ella, la web queda abierta. |

Las tablas se crean solas al primer uso. La web pide a los buscadores que no la indexen.
