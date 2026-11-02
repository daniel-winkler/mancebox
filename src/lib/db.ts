import { createClient, type Client, type InValue, type Transaction } from "@libsql/client";
import { mkdirSync } from "fs";
import path from "path";
import type { AdminSlot, BookingStatus, PublicSlot, Room } from "./types";

type Executor = Client | Transaction;

const DEFAULT_CAPACITY = 15;

let client: Client | null = null;
let schemaReady: Promise<void> | null = null;

function getClient(): Client {
  if (client) return client;

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url) {
    client = createClient({ url, authToken });
  } else {
    // Serverless hosts (Netlify) have a read-only filesystem, so the local SQLite fallback can't work there.
    if (process.env.NETLIFY || process.env.NODE_ENV === "production") {
      throw new Error("TURSO_DATABASE_URL is not set. Configure Turso for production deployments.");
    }
    const dir = path.join(process.cwd(), ".data");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, "mancebox.db").replaceAll("\\", "/");
    client = createClient({ url: `file:${file}` });
  }

  return client;
}

async function exec(db: Executor, sql: string, args: InValue[] = []) {
  return db.execute({ sql, args });
}

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getClient();
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS rooms (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          is_active INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      );
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS slots (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          room_id INTEGER NOT NULL REFERENCES rooms(id),
          label TEXT NOT NULL,
          time TEXT NOT NULL,
          place TEXT NOT NULL,
          capacity INTEGER NOT NULL DEFAULT 15,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )`,
      );
      await exec(
        db,
        `CREATE TABLE IF NOT EXISTS bookings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          slot_id INTEGER NOT NULL REFERENCES slots(id),
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('confirmed', 'waitlist', 'offered')),
          position INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          UNIQUE(slot_id, phone)
        )`,
      );
    })();
    // Don't cache a failure: a transient error on a cold start would otherwise break every later request.
    schemaReady.catch(() => {
      schemaReady = null;
    });
  }
  await schemaReady;
}

export async function db(): Promise<Client> {
  await ensureSchema();
  return getClient();
}

async function getActiveRoom(ex: Executor): Promise<Room | null> {
  const rs = await exec(
    ex,
    `SELECT id, title, is_active, created_at FROM rooms WHERE is_active = 1 ORDER BY id DESC LIMIT 1`,
  );
  return (rs.rows[0] as unknown as Room) ?? null;
}

async function occupiedCount(ex: Executor, slotId: number): Promise<number> {
  const rs = await exec(
    ex,
    `SELECT COUNT(*) AS n FROM bookings WHERE slot_id = ? AND status IN ('confirmed', 'offered')`,
    [slotId],
  );
  return Number(rs.rows[0].n);
}

async function waitlistCount(ex: Executor, slotId: number): Promise<number> {
  const rs = await exec(
    ex,
    `SELECT COUNT(*) AS n FROM bookings WHERE slot_id = ? AND status = 'waitlist'`,
    [slotId],
  );
  return Number(rs.rows[0].n);
}

async function reindexWaitlist(ex: Executor, slotId: number) {
  const rs = await exec(
    ex,
    `SELECT id FROM bookings WHERE slot_id = ? AND status = 'waitlist' ORDER BY position ASC, id ASC`,
    [slotId],
  );
  let i = 1;
  for (const row of rs.rows) {
    await exec(ex, `UPDATE bookings SET position = ? WHERE id = ?`, [i, row.id as number]);
    i += 1;
  }
}

async function promoteWaitlistWhileSpace(ex: Executor, slotId: number, capacity: number) {
  while (true) {
    const occupied = await occupiedCount(ex, slotId);
    if (occupied >= capacity) return;
    const next = await exec(
      ex,
      `SELECT id FROM bookings WHERE slot_id = ? AND status = 'waitlist' ORDER BY position ASC, id ASC LIMIT 1`,
      [slotId],
    );
    if (!next.rows[0]) return;
    await exec(
      ex,
      `UPDATE bookings SET status = 'offered', position = NULL WHERE id = ?`,
      [next.rows[0].id as number],
    );
    await reindexWaitlist(ex, slotId);
  }
}

async function loadPublicSlots(ex: Executor, roomId: number, phone: string | null): Promise<PublicSlot[]> {
  const slotRs = await exec(
    ex,
    `SELECT id, room_id, label, time, place, capacity FROM slots WHERE room_id = ? ORDER BY id ASC`,
    [roomId],
  );
  const slots: PublicSlot[] = [];

  for (const row of slotRs.rows) {
    const slotId = row.id as number;
    const capacity = row.capacity as number;
    const counts = await exec(
      ex,
      `SELECT
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmedCount,
        SUM(CASE WHEN status = 'waitlist' THEN 1 ELSE 0 END) AS waitlistCount,
        SUM(CASE WHEN status = 'offered' THEN 1 ELSE 0 END) AS offeredCount
       FROM bookings WHERE slot_id = ?`,
      [slotId],
    );
    const waitRs = await exec(
      ex,
      `SELECT name, position FROM bookings WHERE slot_id = ? AND status = 'waitlist' ORDER BY position ASC, id ASC`,
      [slotId],
    );
    let myBooking = null;
    if (phone) {
      const mine = await exec(
        ex,
        `SELECT status, position FROM bookings WHERE slot_id = ? AND phone = ?`,
        [slotId, phone],
      );
      if (mine.rows[0]) {
        myBooking = {
          status: mine.rows[0].status as BookingStatus,
          position: mine.rows[0].position == null ? null : Number(mine.rows[0].position),
        };
      }
    }

    slots.push({
      id: slotId,
      room_id: row.room_id as number,
      label: row.label as string,
      time: row.time as string,
      place: row.place as string,
      capacity,
      confirmedCount: Number(counts.rows[0].confirmedCount || 0),
      waitlistCount: Number(counts.rows[0].waitlistCount || 0),
      offeredCount: Number(counts.rows[0].offeredCount || 0),
      waitlist: waitRs.rows.map((w) => ({
        name: w.name as string,
        position: Number(w.position),
      })),
      myBooking,
    });
  }

  return slots;
}

export async function getSchedule(phone: string | null) {
  const ex = await db();
  const room = await getActiveRoom(ex);
  if (!room) return { room: null, slots: [] as PublicSlot[] };
  const slots = await loadPublicSlots(ex, room.id, phone);
  return { room, slots };
}

export async function getAdminSchedule() {
  const ex = await db();
  const room = await getActiveRoom(ex);
  if (!room) return { room: null, slots: [] as AdminSlot[] };
  const publicSlots = await loadPublicSlots(ex, room.id, null);
  const slots: AdminSlot[] = [];
  for (const slot of publicSlots) {
    const confirmed = await exec(
      ex,
      `SELECT name, phone FROM bookings WHERE slot_id = ? AND status = 'confirmed' ORDER BY id ASC`,
      [slot.id],
    );
    const offered = await exec(
      ex,
      `SELECT name, phone FROM bookings WHERE slot_id = ? AND status = 'offered' ORDER BY id ASC`,
      [slot.id],
    );
    const waitlistFull = await exec(
      ex,
      `SELECT name, phone, position FROM bookings WHERE slot_id = ? AND status = 'waitlist' ORDER BY position ASC, id ASC`,
      [slot.id],
    );
    slots.push({
      ...slot,
      confirmed: confirmed.rows.map((r) => ({ name: r.name as string, phone: r.phone as string })),
      offered: offered.rows.map((r) => ({ name: r.name as string, phone: r.phone as string })),
      waitlistFull: waitlistFull.rows.map((r) => ({
        name: r.name as string,
        phone: r.phone as string,
        position: Number(r.position),
      })),
    });
  }
  return { room, slots };
}

export async function createRoom(title: string) {
  const client = await db();
  const txn = await client.transaction("write");
  try {
    await exec(txn, `UPDATE rooms SET is_active = 0 WHERE is_active = 1`);
    const rs = await exec(txn, `INSERT INTO rooms (title, is_active) VALUES (?, 1)`, [title]);
    await txn.commit();
    return Number(rs.lastInsertRowid);
  } catch (error) {
    await txn.rollback();
    throw error;
  }
}

export async function addSlot(label: string, time: string, place: string) {
  const client = await db();
  const txn = await client.transaction("write");
  try {
    const room = await getActiveRoom(txn);
    if (!room) {
      await txn.rollback();
      return { error: "No hay una sala activa. Crea una sala primero." as const };
    }
    const rs = await exec(
      txn,
      `INSERT INTO slots (room_id, label, time, place, capacity) VALUES (?, ?, ?, ?, ?)`,
      [room.id, label, time, place, DEFAULT_CAPACITY],
    );
    await txn.commit();
    return { id: Number(rs.lastInsertRowid) };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
}

export async function joinSlot(slotId: number, name: string, phone: string) {
  const client = await db();
  const txn = await client.transaction("write");
  try {
    const slotRs = await exec(
      txn,
      `SELECT s.id, s.capacity, s.room_id, r.is_active
       FROM slots s JOIN rooms r ON r.id = s.room_id
       WHERE s.id = ?`,
      [slotId],
    );
    const slot = slotRs.rows[0];
    if (!slot || Number(slot.is_active) !== 1) {
      await txn.rollback();
      return { error: "Esta sesión no está disponible." as const };
    }

    const existing = await exec(
      txn,
      `SELECT id, status FROM bookings WHERE slot_id = ? AND phone = ?`,
      [slotId, phone],
    );
    if (existing.rows[0]) {
      await txn.rollback();
      return { error: "Ya estás apuntado a esta sesión." as const };
    }

    const capacity = Number(slot.capacity);
    const occupied = await occupiedCount(txn, slotId);
    const waiting = await waitlistCount(txn, slotId);

    if (waiting > 0 || occupied >= capacity) {
      const maxPos = await exec(
        txn,
        `SELECT COALESCE(MAX(position), 0) AS m FROM bookings WHERE slot_id = ? AND status = 'waitlist'`,
        [slotId],
      );
      const position = Number(maxPos.rows[0].m) + 1;
      await exec(
        txn,
        `INSERT INTO bookings (slot_id, name, phone, status, position) VALUES (?, ?, ?, 'waitlist', ?)`,
        [slotId, name, phone, position],
      );
      await txn.commit();
      return { status: "waitlist" as const, position };
    }

    await exec(
      txn,
      `INSERT INTO bookings (slot_id, name, phone, status, position) VALUES (?, ?, ?, 'confirmed', NULL)`,
      [slotId, name, phone],
    );
    await txn.commit();
    return { status: "confirmed" as const };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
}

export async function cancelBooking(slotId: number, phone: string) {
  const client = await db();
  const txn = await client.transaction("write");
  try {
    const mine = await exec(
      txn,
      `SELECT id, status FROM bookings WHERE slot_id = ? AND phone = ?`,
      [slotId, phone],
    );
    const row = mine.rows[0];
    if (!row) {
      await txn.rollback();
      return { error: "No tienes reserva en esta sesión." as const };
    }

    const status = row.status as BookingStatus;
    await exec(txn, `DELETE FROM bookings WHERE id = ?`, [row.id as number]);

    const slotRs = await exec(txn, `SELECT capacity FROM slots WHERE id = ?`, [slotId]);
    const capacity = Number(slotRs.rows[0].capacity);

    if (status === "waitlist") {
      await reindexWaitlist(txn, slotId);
    } else {
      await promoteWaitlistWhileSpace(txn, slotId, capacity);
    }

    await txn.commit();
    return { ok: true as const };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
}

export async function acceptOffer(slotId: number, phone: string) {
  const client = await db();
  const txn = await client.transaction("write");
  try {
    const mine = await exec(
      txn,
      `SELECT id, status FROM bookings WHERE slot_id = ? AND phone = ?`,
      [slotId, phone],
    );
    const row = mine.rows[0];
    if (!row || (row.status as string) !== "offered") {
      await txn.rollback();
      return { error: "No tienes una oferta pendiente en esta sesión." as const };
    }
    await exec(txn, `UPDATE bookings SET status = 'confirmed', position = NULL WHERE id = ?`, [
      row.id as number,
    ]);
    await txn.commit();
    return { ok: true as const };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
}

export async function declineOffer(slotId: number, phone: string) {
  return cancelBooking(slotId, phone);
}

export async function skipOffer(slotId: number) {
  const client = await db();
  const txn = await client.transaction("write");
  try {
    const offered = await exec(
      txn,
      `SELECT id FROM bookings WHERE slot_id = ? AND status = 'offered' ORDER BY id ASC LIMIT 1`,
      [slotId],
    );
    if (!offered.rows[0]) {
      await txn.rollback();
      return { error: "No hay ninguna oferta pendiente en esta sesión." as const };
    }
    await exec(txn, `DELETE FROM bookings WHERE id = ?`, [offered.rows[0].id as number]);
    const slotRs = await exec(txn, `SELECT capacity FROM slots WHERE id = ?`, [slotId]);
    await promoteWaitlistWhileSpace(txn, slotId, Number(slotRs.rows[0].capacity));
    await txn.commit();
    return { ok: true as const };
  } catch (error) {
    await txn.rollback();
    throw error;
  }
}
