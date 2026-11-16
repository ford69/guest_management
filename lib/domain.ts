import type {
  DashboardGuest,
  Guest,
  ReceptionTable,
  RsvpStatus,
} from "@/lib/types";

export const RSVP_LABELS: Record<RsvpStatus, string> = {
  pending: "Awaiting reply",
  attending: "Ceremony & reception",
  ceremony: "Ceremony only",
  declined: "Declined",
};

export function rsvpStatus(guest: DashboardGuest): RsvpStatus {
  if (guest.ceremony && guest.reception) return "attending";
  if (guest.ceremony) return "ceremony";
  if (!guest.rsvpAt) return "pending";
  return "declined";
}

export function partySize(guest: Guest): number {
  return guest.seats + (guest.plusOneName ? 1 : 0);
}

export function occupiedSeats(
  guests: Guest[],
  tableId: number,
): number {
  return guests
    .filter((guest) => guest.table === tableId)
    .reduce((total, guest) => total + partySize(guest), 0);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .filter((part) => !["&", "Mrs.", "Mr.", "The"].includes(part))
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
}

export function clean(value: unknown, max = 120): string {
  return String(value ?? "")
    .trim()
    .slice(0, max);
}

export function invitationCode(raw: string): string {
  return clean(raw, 12).toUpperCase();
}

export function tableHasCapacity(
  tables: ReceptionTable[],
  guests: Guest[],
  tableId: number,
  extraSeats: number,
): boolean {
  const table = tables.find((item) => item.id === tableId);
  if (!table) return false;
  return occupiedSeats(guests, tableId) + extraSeats <= table.capacity;
}
