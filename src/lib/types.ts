export type BookingStatus = "confirmed" | "waitlist" | "offered";

export type Room = {
  id: number;
  title: string;
  is_active: number;
  created_at: string;
};

export type Slot = {
  id: number;
  room_id: number;
  label: string;
  time: string;
  place: string;
  capacity: number;
};

export type Booking = {
  id: number;
  slot_id: number;
  name: string;
  phone: string;
  status: BookingStatus;
  position: number | null;
  created_at: string;
};

export type WaitlistEntry = {
  name: string;
  position: number;
};

export type MyBooking = {
  status: BookingStatus;
  position: number | null;
};

export type PublicSlot = Slot & {
  confirmedCount: number;
  waitlistCount: number;
  offeredCount: number;
  waitlist: WaitlistEntry[];
  myBooking: MyBooking | null;
};

export type AdminSlot = PublicSlot & {
  confirmed: { name: string; phone: string }[];
  offered: { name: string; phone: string }[];
  waitlistFull: { name: string; phone: string; position: number }[];
};
