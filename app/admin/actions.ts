"use server";

import {
  errorMessage,
  fail,
  ok,
  requireAdmin,
  type ActionResult,
} from "@/lib/auth";
import { clean, occupiedSeats } from "@/lib/domain";
import { GUEST_COLUMNS, mapDashboardGuest, mapTable } from "@/lib/mappers";
import { createClient } from "@/lib/supabase/server";
import type {
  DashboardGuest,
  GuestRow,
  ReceptionTable,
  RsvpStatus,
  TableRow,
} from "@/lib/types";

type Dashboard = { guests: DashboardGuest[]; tables: ReceptionTable[] };

export type GuestInput = {
  name: string;
  category: string;
  seats: number;
  plusOne: boolean;
  plusOneName: string;
  rsvp: RsvpStatus;
  table: number | null;
  checked: boolean;
};

export type TableInput = {
  name: string;
  capacity: number;
};

type Client = Awaited<ReturnType<typeof requireAdmin>>;

async function fetchDashboard(supabase: Client): Promise<Dashboard> {
  const [guestResult, tableResult] = await Promise.all([
    supabase.from("guests").select(GUEST_COLUMNS).order("name"),
    supabase.from("reception_tables").select("id, name, capacity").order("id"),
  ]);
  if (guestResult.error) throw new Error(guestResult.error.message);
  if (tableResult.error) throw new Error(tableResult.error.message);
  return {
    guests: (guestResult.data as GuestRow[]).map(mapDashboardGuest),
    tables: (tableResult.data as TableRow[]).map(mapTable),
  };
}

export async function getAdminEmail(): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;
  return typeof email === "string" ? email : null;
}

export async function signOutAdmin(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

export async function loadDashboard(): Promise<ActionResult<Dashboard>> {
  try {
    return ok(await fetchDashboard(await requireAdmin()));
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function saveGuest(
  id: number | null,
  input: GuestInput,
): Promise<ActionResult<null>> {
  try {
    const supabase = await requireAdmin();
    const name = clean(input.name);
    const seats = Number(input.seats);
    if (!name || !Number.isInteger(seats) || seats < 1 || seats > 12) {
      return fail("A name and 1–12 reserved seats are required.");
    }

    const { guests, tables } = await fetchDashboard(supabase);
    const existing = id ? guests.find((guest) => guest.id === id) : undefined;
    if (id && !existing) return fail("Guest not found.");

    const ceremony = input.rsvp === "attending" || input.rsvp === "ceremony";
    const reception = input.rsvp === "attending";
    const plusOneName =
      input.plusOne && reception ? clean(input.plusOneName) : "";

    if (input.table) {
      const table = tables.find((item) => item.id === input.table);
      if (!table) return fail("Table not found.");
      const others = guests.filter((guest) => guest.id !== id);
      const party = seats + (plusOneName ? 1 : 0);
      if (occupiedSeats(others, table.id) + party > table.capacity) {
        return fail(`${table.name} does not have enough seats for this party.`);
      }
    }

    const now = new Date().toISOString();
    const values = {
      name,
      category: clean(input.category, 60) || "Uncategorised",
      reserved_seats: seats,
      plus_one_allowed: Boolean(input.plusOne),
      plus_one_name: plusOneName,
      attending_ceremony: ceremony,
      attending_reception: reception,
      rsvp_at: input.rsvp === "pending" ? null : (existing?.rsvpAt ?? now),
      table_id: input.table,
      checked_in_at: input.checked ? (existing?.checkedInAt ?? now) : null,
      updated_at: now,
    };

    if (id) {
      const { error } = await supabase.from("guests").update(values).eq("id", id);
      return error ? fail(error.message) : ok(null);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `WP-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error } = await supabase
        .from("guests")
        .insert({ ...values, invitation_code: code });
      if (!error) return ok(null);
      if (error.code !== "23505") return fail(error.message);
    }
    return fail("Could not create a unique invitation code. Please try again.");
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function deleteGuest(id: number): Promise<ActionResult<null>> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("guests").delete().eq("id", id);
    return error ? fail(error.message) : ok(null);
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function saveTable(
  id: number | null,
  input: TableInput,
): Promise<ActionResult<null>> {
  try {
    const supabase = await requireAdmin();
    const name = clean(input.name, 60);
    const capacity = Number(input.capacity);
    if (!name) return fail("A table name is required.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      return fail("Capacity must be between 1 and 30.");
    }

    if (id) {
      const { guests } = await fetchDashboard(supabase);
      const seated = occupiedSeats(guests, id);
      if (capacity < seated) {
        return fail(`Capacity cannot be below the ${seated} seats already assigned.`);
      }
    }

    const { error } = id
      ? await supabase.from("reception_tables").update({ name, capacity }).eq("id", id)
      : await supabase.from("reception_tables").insert({ name, capacity });
    if (error?.code === "23505") return fail("A table with that name already exists.");
    return error ? fail(error.message) : ok(null);
  } catch (error) {
    return fail(errorMessage(error));
  }
}

export async function deleteTable(id: number): Promise<ActionResult<null>> {
  try {
    const supabase = await requireAdmin();
    const { error } = await supabase.from("reception_tables").delete().eq("id", id);
    return error ? fail(error.message) : ok(null);
  } catch (error) {
    return fail(errorMessage(error));
  }
}