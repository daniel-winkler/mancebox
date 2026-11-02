"use client";

import { useCallback, useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import {
  acceptOffer,
  adminLogin,
  adminLogout,
  bookSlot,
  cancelSlot,
  createRoom,
  createSlot,
  declineOffer,
  fetchAdminSession,
  fetchSchedule,
  skipOffer,
  type AdminPayload,
  type SchedulePayload,
} from "@/lib/client-api";
import { hasProfile, loadProfile, saveProfile, type Profile } from "@/lib/profile";
import type { AdminSlot, PublicSlot } from "@/lib/types";

type Tab = "schedule" | "bookings" | "profile";

function occupied(slot: PublicSlot) {
  return slot.confirmedCount + slot.offeredCount;
}

function isFull(slot: PublicSlot) {
  return occupied(slot) >= slot.capacity;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("profile");
  const [adminMode, setAdminMode] = useState(false);
  const [profile, setProfile] = useState<Profile>({ name: "", phone: "" });
  const [nameDraft, setNameDraft] = useState("");
  const [phoneDraft, setPhoneDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [schedule, setSchedule] = useState<SchedulePayload>({ room: null, slots: [] });
  const [openWait, setOpenWait] = useState<Record<number, boolean>>({});
  const [openParticipants, setOpenParticipants] = useState<Record<number, boolean>>({});
  const [admin, setAdmin] = useState<AdminPayload>({ admin: false });
  const [password, setPassword] = useState("");
  const [showNewRoom, setShowNewRoom] = useState(false);
  const [showNewSlot, setShowNewSlot] = useState(false);
  const [roomTitle, setRoomTitle] = useState("");
  const [slotDay, setSlotDay] = useState("");
  const [slotTime, setSlotTime] = useState("18:00");
  const [slotPlace, setSlotPlace] = useState("");

  const ready = hasProfile(profile);

  const load = useCallback(async (phone: string) => {
    const data = await fetchSchedule(phone);
    setSchedule(data);
    return data;
  }, []);

  useEffect(() => {
    const stored = loadProfile();
    setProfile(stored);
    setNameDraft(stored.name);
    setPhoneDraft(stored.phone);
    void load(stored.phone).catch((err: Error) => setError(err.message));
    void fetchAdminSession()
      .then(setAdmin)
      .catch(() => setAdmin({ admin: false }));
    if (!hasProfile(stored)) {
      setNotice("Completa tu perfil en este dispositivo para poder reservar.");
    } else {
      setTab("schedule");
    }
  }, [load]);

  async function withBusy(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ha ocurrido un error.");
    } finally {
      setBusy(false);
    }
  }

  function go(next: Tab) {
    setTab(next);
    if (next === "profile" && !ready) {
      setNotice("Completa tu perfil en este dispositivo para poder reservar.");
    }
  }

  function switchMode(toAdmin: boolean) {
    setAdminMode(toAdmin);
    setNotice("");
    setError("");
  }

  function needProfile() {
    setTab("profile");
    setNotice("Completa tu perfil antes de reservar.");
  }

  async function persistProfile(event: FormEvent) {
    event.preventDefault();
    const next = { name: nameDraft.trim(), phone: phoneDraft.trim() };
    if (!hasProfile(next)) {
      setError("Introduce nombre y un teléfono de al menos 9 dígitos.");
      return;
    }
    saveProfile(next);
    setProfile(next);
    setNotice("Datos guardados correctamente en este dispositivo.");
    setError("");
    await withBusy(async () => {
      await load(next.phone);
      setTab("schedule");
    });
  }

  async function join(slot: PublicSlot) {
    if (!ready) return needProfile();
    await withBusy(async () => {
      const result = (await bookSlot(slot.id, profile.name, profile.phone)) as {
        status: string;
        position?: number;
      };
      await load(profile.phone);
      if (result.status === "waitlist") {
        setNotice(`Estás en la lista de espera. Tu posición es ${result.position}.`);
      } else {
        setNotice("¡Reserva confirmada!");
      }
    });
  }

  async function cancel(slotId: number, waiting: boolean) {
    await withBusy(async () => {
      await cancelSlot(slotId, profile.phone);
      await load(profile.phone);
      setNotice(waiting ? "Has abandonado la lista de espera." : "Has cancelado tu reserva.");
    });
  }

  async function accept(slotId: number) {
    await withBusy(async () => {
      await acceptOffer(slotId, profile.phone);
      await load(profile.phone);
      setNotice("¡Has aceptado la plaza! Tu reserva está confirmada.");
    });
  }

  async function decline(slotId: number) {
    await withBusy(async () => {
      await declineOffer(slotId, profile.phone);
      await load(profile.phone);
      setNotice("Has rechazado la oferta. Se ofrecerá al siguiente participante.");
    });
  }

  async function login(event: FormEvent) {
    event.preventDefault();
    await withBusy(async () => {
      const data = await adminLogin(password);
      setAdmin(data);
      setPassword("");
      setNotice("Acceso de administrador concedido.");
    });
  }

  async function logout() {
    await withBusy(async () => {
      await adminLogout();
      setAdmin({ admin: false });
      setAdminMode(false);
      setTab("schedule");
      setNotice("Has salido del panel de administración.");
    });
  }

  async function saveRoom(event: FormEvent) {
    event.preventDefault();
    await withBusy(async () => {
      const data = await createRoom(roomTitle);
      setAdmin(data);
      setRoomTitle("");
      setShowNewRoom(false);
      await load(profile.phone);
      setNotice("Plan creado y activado. Los usuarios verán esta semana.");
    });
  }

  async function saveSlot(event: FormEvent) {
    event.preventDefault();
    await withBusy(async () => {
      const data = await createSlot(slotDay, slotTime, slotPlace);
      setAdmin(data);
      setSlotDay("");
      setSlotPlace("");
      setShowNewSlot(false);
      await load(profile.phone);
      setNotice("Sesión añadida al plan activo.");
    });
  }

  async function passOffer(slotId: number) {
    await withBusy(async () => {
      const data = await skipOffer(slotId);
      setAdmin(data);
      await load(profile.phone);
      setNotice("La oferta se ha pasado al siguiente de la lista de espera.");
    });
  }

  const myBookings = useMemo(
    () => schedule.slots.filter((slot) => slot.myBooking),
    [schedule.slots],
  );

  const totals = useMemo(() => {
    const slots = admin.slots ?? [];
    const taken = slots.reduce((sum, slot) => sum + occupied(slot), 0);
    const cap = slots.reduce((sum, slot) => sum + slot.capacity, 0);
    return { taken, cap, count: slots.length };
  }, [admin.slots]);

  return (
    <main className="app">
      {adminMode ? (
        <header className="admin-bar">
          <div>
            <b>Panel del organizador</b>
            <div className="small">MANCEBOX</div>
          </div>
          <button type="button" className="btn secondary" onClick={() => switchMode(false)}>
            ← Volver a reservas
          </button>
        </header>
      ) : (
        <>
          <header className="hero">
            <div className="brand">
              <div>
                MANCEBOX
                <div className="muted-light">COMUNIDAD DE CROSSTRAINING</div>
              </div>
              <button type="button" className="hero-admin" onClick={() => switchMode(true)}>
                ⚙ Organizador
              </button>
            </div>
            <h1>¡Hola{profile.name ? `, ${profile.name}` : ""}!</h1>
            <p>Reserva tu entrenamiento.</p>
            <div className="identity">
              ◉ <span>{profile.phone || "Sin identificar"}</span>
            </div>
          </header>

          <nav className="nav">
            <button type="button" className={tab === "schedule" ? "active" : ""} onClick={() => go("schedule")}>
              ▦ Horarios
            </button>
            <button type="button" className={tab === "bookings" ? "active" : ""} onClick={() => go("bookings")}>
              {"☑︎"} Mis reservas
            </button>
            <button type="button" className={tab === "profile" ? "active" : ""} onClick={() => go("profile")}>
              ♙ Perfil
            </button>
          </nav>
        </>
      )}

      <section className="content">
        <div className={`notice${error ? " error" : notice ? "" : " empty"}`}>{error || notice}</div>

        {!adminMode && tab === "schedule" && (
          <ScheduleView
            schedule={schedule}
            busy={busy}
            openWait={openWait}
            setOpenWait={setOpenWait}
            openParticipants={openParticipants}
            setOpenParticipants={setOpenParticipants}
            onJoin={join}
            onCancel={cancel}
            onAccept={accept}
            onDecline={decline}
          />
        )}

        {!adminMode && tab === "bookings" && (
          <BookingsView
            slots={myBookings}
            busy={busy}
            onCancel={cancel}
            onAccept={accept}
            onDecline={decline}
          />
        )}

        {!adminMode && tab === "profile" && (
          <form onSubmit={persistProfile}>
            <h2>Tu perfil</h2>
            <p className="sub">Estos datos se utilizarán para identificarte al reservar.</p>
            <div className="box">
              <div className="center">
                <b>Identificación del participante</b>
                <p className="small">Perfil guardado en este dispositivo</p>
              </div>
              <label className="field" htmlFor="name">
                Nombre
              </label>
              <input id="name" value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} required />
              <label className="field" htmlFor="phone">
                Teléfono
              </label>
              <input
                id="phone"
                value={phoneDraft}
                onChange={(e) => setPhoneDraft(e.target.value)}
                type="tel"
                required
              />
              <button className="btn" disabled={busy}>
                Guardar mis datos
              </button>
              <p className="small">
                El teléfono es tu identificador. Si cambias de dispositivo, tendrás que volver a
                introducirlo.
              </p>
            </div>
          </form>
        )}

        {adminMode &&
          (admin.admin ? (
            <AdminView
              admin={admin}
              totals={totals}
              busy={busy}
              showNewRoom={showNewRoom}
              showNewSlot={showNewSlot}
              roomTitle={roomTitle}
              slotDay={slotDay}
              slotTime={slotTime}
              slotPlace={slotPlace}
              setShowNewRoom={setShowNewRoom}
              setShowNewSlot={setShowNewSlot}
              setRoomTitle={setRoomTitle}
              setSlotDay={setSlotDay}
              setSlotTime={setSlotTime}
              setSlotPlace={setSlotPlace}
              onSaveRoom={saveRoom}
              onSaveSlot={saveSlot}
              onPassOffer={passOffer}
              onLogout={logout}
            />
          ) : (
            <form onSubmit={login}>
              <div className="center">
                <h2>Administración</h2>
                <p className="sub">
                  Introduce la contraseña del organizador para gestionar los planes y horarios.
                </p>
              </div>
              <label className="field" htmlFor="password">
                Contraseña de administrador
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
              />
              <button className="btn" disabled={busy}>
                Acceder
              </button>
            </form>
          ))}
      </section>
      <footer className="footer">MANCEBOX · Reserva tu entrenamiento</footer>
    </main>
  );
}

function SlotCard({
  slot,
  busy,
  open,
  onToggleWait,
  openParticipants,
  onToggleParticipants,
  onJoin,
  onCancel,
  onAccept,
  onDecline,
}: {
  slot: PublicSlot;
  busy: boolean;
  open: boolean;
  onToggleWait: () => void;
  openParticipants: boolean;
  onToggleParticipants: () => void;
  onJoin: () => void;
  onCancel: (waiting: boolean) => void;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const taken = occupied(slot);
  const full = isFull(slot);
  const mine = slot.myBooking;

  return (
    <article className="slot">
      <div className="row">
        <div>
          <div className="time">{slot.time}</div>
          <div className="place">{slot.place}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="count">
            {taken}/{slot.capacity}
          </div>
          <div className="small">Plazas ocupadas</div>
        </div>
      </div>
      <div className={`bar${full ? " full" : ""}`}>
        <span style={{ width: `${Math.min(100, (taken / slot.capacity) * 100)}%` }} />
      </div>

      {mine?.status === "offered" && (
        <div className="box">
          <span className="pill wait">¡Plaza disponible para ti!</span>
          <p>
            <b>Tienes una oferta de plaza</b>
          </p>
          <p className="small">Eres el primero de la lista de espera. ¿Quieres ocuparla?</p>
          <button className="btn" disabled={busy} onClick={onAccept}>
            Aceptar plaza
          </button>
          <button className="btn secondary" disabled={busy} onClick={onDecline}>
            Rechazar oferta
          </button>
        </div>
      )}
      {mine?.status === "confirmed" && (
        <>
          <span className="pill">Tu plaza está confirmada</span>
          <button className="btn danger" disabled={busy} onClick={() => onCancel(false)}>
            Cancelar reserva
          </button>
        </>
      )}
      {mine?.status === "waitlist" && (
        <>
          <span className="pill wait">Estás en lista de espera · posición {mine.position}</span>
          <button className="btn danger" disabled={busy} onClick={() => onCancel(true)}>
            Salir de lista de espera
          </button>
        </>
      )}
      {!mine && full && (
        <>
          <div className="small">
            {slot.waitlistCount} {slot.waitlistCount === 1 ? "persona" : "personas"} en lista de espera.
          </div>
          <button className="btn" disabled={busy} onClick={onJoin}>
            Apuntarme a lista de espera
          </button>
        </>
      )}
      {!mine && !full && (
        <button className="btn" disabled={busy} onClick={onJoin}>
          Reservar plaza
        </button>
      )}

      {slot.confirmedNames.length > 0 && (
        <>
          <button className="link" type="button" onClick={onToggleParticipants}>
            {openParticipants
              ? "Ocultar participantes"
              : `Ver participantes (${slot.confirmedNames.length})`}
          </button>
          {openParticipants && (
            <div className="waitlist participants">
              {slot.confirmedNames.map((name, i) => (
                <div className="waititem" key={`${i}-${name}`}>
                  {name}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {(slot.waitlistCount > 0 || slot.offeredCount > 0) && (
        <>
          <button className="link" type="button" onClick={onToggleWait}>
            {open ? "Ocultar lista de espera" : "Ver lista de espera"}
          </button>
          {open && (
            <div className="waitlist">
              {slot.offeredCount > 0 && (
                <div className="waititem">Oferta pendiente: {slot.offeredCount}</div>
              )}
              {slot.waitlist.length > 0 && (
                <ol className="waitorder">
                  {slot.waitlist.map((item) => (
                    <li key={`${item.position}-${item.name}`}>{item.name}</li>
                  ))}
                </ol>
              )}
              {slot.waitlist.length === 0 && slot.offeredCount === 0 && (
                <div className="small">Nadie en espera.</div>
              )}
            </div>
          )}
        </>
      )}
    </article>
  );
}

function ScheduleView({
  schedule,
  busy,
  openWait,
  setOpenWait,
  openParticipants,
  setOpenParticipants,
  onJoin,
  onCancel,
  onAccept,
  onDecline,
}: {
  schedule: SchedulePayload;
  busy: boolean;
  openWait: Record<number, boolean>;
  setOpenWait: Dispatch<SetStateAction<Record<number, boolean>>>;
  openParticipants: Record<number, boolean>;
  setOpenParticipants: Dispatch<SetStateAction<Record<number, boolean>>>;
  onJoin: (slot: PublicSlot) => void;
  onCancel: (slotId: number, waiting: boolean) => void;
  onAccept: (slotId: number) => void;
  onDecline: (slotId: number) => void;
}) {
  return (
    <div>
      <h2>Entrenamientos</h2>
      <p className="sub">Selecciona una sesión para reservar tu plaza.</p>
      {schedule.room ? (
        <div className="room">
          <b>{schedule.room.title}</b>
          <div className="small">
            Plan activo · {schedule.slots.length}{" "}
            {schedule.slots.length === 1 ? "sesión programada" : "sesiones programadas"}
          </div>
        </div>
      ) : (
        <div className="box">
          <p className="small">
            Todavía no hay una semana publicada. El organizador creará el plan desde Admin.
          </p>
        </div>
      )}
      {schedule.slots.map((slot) => (
        <div key={slot.id}>
          <div className="row">
            <b>{slot.label}</b>
            <span className={`pill${isFull(slot) ? " full" : ""}`}>
              {isFull(slot) ? "Completo" : "Disponible"}
            </span>
          </div>
          <SlotCard
            slot={slot}
            busy={busy}
            open={Boolean(openWait[slot.id])}
            onToggleWait={() => setOpenWait((prev) => ({ ...prev, [slot.id]: !prev[slot.id] }))}
            openParticipants={Boolean(openParticipants[slot.id])}
            onToggleParticipants={() =>
              setOpenParticipants((prev) => ({ ...prev, [slot.id]: !prev[slot.id] }))
            }
            onJoin={() => onJoin(slot)}
            onCancel={(waiting) => onCancel(slot.id, waiting)}
            onAccept={() => onAccept(slot.id)}
            onDecline={() => onDecline(slot.id)}
          />
        </div>
      ))}
    </div>
  );
}

function BookingsView({
  slots,
  busy,
  onCancel,
  onAccept,
  onDecline,
}: {
  slots: PublicSlot[];
  busy: boolean;
  onCancel: (slotId: number, waiting: boolean) => void;
  onAccept: (slotId: number) => void;
  onDecline: (slotId: number) => void;
}) {
  if (slots.length === 0) {
    return (
      <div>
        <h2>Mis reservas</h2>
        <p className="sub">Tus entrenamientos y solicitudes pendientes.</p>
        <div className="center small">
          <b>Todavía no tienes reservas</b>
          <br />
          Cuando te apuntes a un entrenamiento, aparecerá aquí.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2>Mis reservas</h2>
      <p className="sub">Tus entrenamientos y solicitudes pendientes.</p>
      <div className="stack">
        {slots.map((slot) => {
          const status = slot.myBooking?.status;
          return (
            <div className="box" key={slot.id}>
              <span className={`pill${status === "confirmed" ? "" : " wait"}`}>
                {status === "confirmed"
                  ? "Confirmada"
                  : status === "offered"
                    ? "Oferta pendiente"
                    : "Lista de espera"}
              </span>
              <p>
                <b>
                  {slot.label} · {slot.time}
                </b>
              </p>
              <p className="small">
                {slot.place}
                {status === "waitlist" ? ` · Posición ${slot.myBooking?.position}` : ""}
              </p>
              {status === "offered" && (
                <>
                  <button className="btn" disabled={busy} onClick={() => onAccept(slot.id)}>
                    Aceptar plaza
                  </button>
                  <button className="btn secondary" disabled={busy} onClick={() => onDecline(slot.id)}>
                    Rechazar
                  </button>
                </>
              )}
              {status === "confirmed" && (
                <button className="btn danger" disabled={busy} onClick={() => onCancel(slot.id, false)}>
                  Cancelar reserva
                </button>
              )}
              {status === "waitlist" && (
                <button className="btn danger" disabled={busy} onClick={() => onCancel(slot.id, true)}>
                  Salir de lista de espera
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AdminView({
  admin,
  totals,
  busy,
  showNewRoom,
  showNewSlot,
  roomTitle,
  slotDay,
  slotTime,
  slotPlace,
  setShowNewRoom,
  setShowNewSlot,
  setRoomTitle,
  setSlotDay,
  setSlotTime,
  setSlotPlace,
  onSaveRoom,
  onSaveSlot,
  onPassOffer,
  onLogout,
}: {
  admin: AdminPayload;
  totals: { taken: number; cap: number; count: number };
  busy: boolean;
  showNewRoom: boolean;
  showNewSlot: boolean;
  roomTitle: string;
  slotDay: string;
  slotTime: string;
  slotPlace: string;
  setShowNewRoom: (v: boolean) => void;
  setShowNewSlot: (v: boolean) => void;
  setRoomTitle: (v: string) => void;
  setSlotDay: (v: string) => void;
  setSlotTime: (v: string) => void;
  setSlotPlace: (v: string) => void;
  onSaveRoom: (event: FormEvent) => void;
  onSaveSlot: (event: FormEvent) => void;
  onPassOffer: (slotId: number) => void;
  onLogout: () => void;
}) {
  const slots = admin.slots ?? [];
  const [confirmReplace, setConfirmReplace] = useState(false);

  // Creating a plan deactivates the current one, so ask before replacing it.
  function submitRoom(event: FormEvent) {
    if (admin.room && !confirmReplace) {
      event.preventDefault();
      setConfirmReplace(true);
      return;
    }
    onSaveRoom(event);
  }

  return (
    <div>
      <div className="row">
        <h2>Panel de gestión</h2>
        <span className="pill">Organizador</span>
      </div>
      <p className="sub">Gestiona los planes y las sesiones de entrenamiento.</p>
      <div className="box">
        <b>Plan actual</b>
        <p className="small">{admin.room?.title ?? "Ningún plan activo"}</p>
        <div className="row small">
          <span>Sesiones programadas</span>
          <b>{totals.count}</b>
        </div>
        <div className="row small">
          <span>Plazas ocupadas</span>
          <b>
            {totals.taken}/{totals.cap || 0}
          </b>
        </div>
        <button
          className="btn secondary"
          type="button"
          onClick={() => {
            setShowNewRoom(!showNewRoom);
            setConfirmReplace(false);
          }}
        >
          Crear nuevo plan
        </button>
        {showNewRoom && (
          <form onSubmit={submitRoom}>
            <label className="field" htmlFor="roomInput">
              Nombre del plan
            </label>
            <input
              id="roomInput"
              value={roomTitle}
              onChange={(e) => {
                setRoomTitle(e.target.value);
                setConfirmReplace(false);
              }}
              placeholder="Nombre de la semana"
            />
            {confirmReplace && admin.room ? (
              <div className="confirm">
                <p>
                  <b>¿Reemplazar el plan «{admin.room.title}»?</b>
                </p>
                <p className="small">
                  Dejará de estar visible junto con sus sesiones y reservas. Esta acción no se puede
                  deshacer.
                </p>
                <button className="btn danger-solid" disabled={busy}>
                  Sí, reemplazar plan
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmReplace(false)}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                <button className="btn" disabled={busy}>
                  Guardar plan
                </button>
                <p className="small">El nuevo plan sustituye al anterior como semana visible.</p>
              </>
            )}
          </form>
        )}
      </div>
      <div className="box">
        <b>Gestionar sesiones</b>
        {slots.map((slot: AdminSlot) => (
          <div key={slot.id}>
            <div className="row small">
              <span>
                {slot.label} · {slot.time}
              </span>
              <b>
                {occupied(slot)}/{slot.capacity}
              </b>
            </div>
            {slot.offered.length > 0 && (
              <>
                <p className="people">
                  Oferta pendiente: {slot.offered.map((p) => `${p.name} (${p.phone})`).join(", ")}
                </p>
                <button className="btn secondary small-btn" type="button" disabled={busy} onClick={() => onPassOffer(slot.id)}>
                  Pasar oferta al siguiente
                </button>
              </>
            )}
            {slot.waitlistFull.length > 0 && (
              <p className="people">
                Espera: {slot.waitlistFull.map((p) => `${p.position}. ${p.name}`).join(" · ")}
              </p>
            )}
          </div>
        ))}
        {slots.length === 0 && <p className="small">Aún no hay sesiones en este plan.</p>}
        <button className="btn secondary" type="button" onClick={() => setShowNewSlot(!showNewSlot)}>
          Añadir sesión
        </button>
        {showNewSlot && (
          <form onSubmit={onSaveSlot}>
            <label className="field" htmlFor="slotDay">
              Día y fecha
            </label>
            <input
              id="slotDay"
              value={slotDay}
              onChange={(e) => setSlotDay(e.target.value)}
              placeholder="Ej. Sábado 14 noviembre"
            />
            <label className="field" htmlFor="slotTime">
              Hora
            </label>
            <input id="slotTime" type="time" value={slotTime} onChange={(e) => setSlotTime(e.target.value)} />
            <label className="field" htmlFor="slotPlace">
              Lugar
            </label>
            <input
              id="slotPlace"
              value={slotPlace}
              onChange={(e) => setSlotPlace(e.target.value)}
              placeholder="Lugar de entrenamiento"
            />
            <button className="btn" disabled={busy}>
              Crear sesión
            </button>
          </form>
        )}
      </div>
      <button className="btn danger" type="button" onClick={onLogout}>
        Cerrar administración
      </button>
    </div>
  );
}
