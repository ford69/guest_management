import type { Guest, GuestRow, ReceptionTable, TableRow } from "@/lib/types";

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

export function mapTable(row: TableRow): ReceptionTable {
  return {
    id: row.id,
    name: row.name,
    capacity: row.capacity,
  };
}
