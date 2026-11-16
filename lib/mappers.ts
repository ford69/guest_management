import type {
  DashboardGuest,
  Guest,
  GuestRow,
  ReceptionTable,
  TableRow,
} from "@/lib/types";

export const GUEST_COLUMNS =
  "id, invitation_code, name, category, reserved_seats, plus_one_allowed, plus_one_name, attending_ceremony, attending_reception, table_id, checked_in_at, rsvp_at";

export function mapGuest(row: GuestRow): Guest {
  return {
    id: row.id,
    code: row.invitation_code,
    name: row.name,
    category: row.category,
    seats: row.reserved_seats,
    plusOne: row.plus_one_allowed,
    plusOneName: row.plus_one_name,
    ceremony: row.attending_ceremony,
    reception: row.attending_reception,
    table: row.table_id,
    checked: Boolean(row.checked_in_at),
  };
}

export function mapDashboardGuest(row: GuestRow): DashboardGuest {
  return {
    ...mapGuest(row),
    rsvpAt: row.rsvp_at ?? null,
    checkedInAt: row.checked_in_at,
  };
}

export function mapTable(row: TableRow): ReceptionTable {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
  };
}
