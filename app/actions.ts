"use server";

import { clean, invitationCode, occupiedSeats, partySize } from "@/lib/domain";
import { GUEST_COLUMNS, mapGuest, mapTable } from "@/lib/mappers";
import { createClient } from "@/lib/supabase/server";
import type { Guest, GuestRow, ReceptionTable, TableRow } from "@/lib/types";

type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

async function publicClient() {
  return createClient();
}

function normalizeGuest(data: Guest): Guest {
  return {
    ...data,
    plusOneName: data.plusOneName ?? "",
    rsvpAt: data.rsvpAt ?? null,
  };
}

async function adminClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    throw new Error("Administrator sign-in is required.");
  }
  return supabase;
}

function fail<T>(error: string): ActionResult<T> {
  return { ok: false, error };
}

function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export async function lookupInvitation(
  code: string,
): Promise<ActionResult<Guest>> {
  const supabase = await publicClient();
  const { data, error } = await supabase.rpc("lookup_invitation", {
    p_code: invitationCode(code),
  });
  if (error) return fail(error.message);
  if (!data) return fail("Invitation not found. Check the code and try again.");
  return ok(normalizeGuest(data as Guest));
}

export async function submitRsvp(input: {
  code: string;
  ceremony: boolean;
  reception: boolean;
  plusOneName: string;
}): Promise<ActionResult<Guest>> {
  const supabase = await publicClient();
  const ceremony = Boolean(input.ceremony);
  const reception = ceremony && Boolean(input.reception);
  const { data, error } = await supabase.rpc("submit_rsvp", {
    p_code: invitationCode(input.code),
    p_ceremony: ceremony,
    p_reception: reception,
    p_plus_one_name: reception ? clean(input.plusOneName) : "",
  });
  if (error) return fail(error.message);
  if (!data) return fail("Invitation not found.");
  return ok(normalizeGuest(data as Guest));
}

export async function loginAdmin(
  email: string,
  password: string,
): Promise<ActionResult<{ email: string }>> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: clean(email, 254).toLowerCase(),
    password,
  });
  if (error || !data.user?.email) {
    return fail("Invalid email or password.");
  }
  return ok({ email: data.user.email });
}

export async function loadAdminState(): Promise<
  ActionResult<{ guests: Guest[]; tables: ReceptionTable[] }>
> {
  try {
    const supabase = await adminClient();
    const [guestResult, tableResult] = await Promise.all([
      supabase
        .from("guests")
        .select(GUEST_COLUMNS)
        .order("name"),
      supabase
        .from("reception_tables")
        .select("id, name, capacity")
        .order("id"),
    ]);
    if (guestResult.error) return fail(guestResult.error.message);
    if (tableResult.error) return fail(tableResult.error.message);
    return ok({
      guests: (guestResult.data as GuestRow[]).map(mapGuest),
      tables: (tableResult.data as TableRow[]).map(mapTable),
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}

export async function checkInGuest(id: number): Promise<ActionResult<Guest>> {
  return patchGuest(id, { checked_in_at: new Date().toISOString() });
}

export async function assignGuestTable(
  id: number,
  tableId: number | null,
): Promise<ActionResult<Guest>> {
  try {
    const supabase = await adminClient();
    if (tableId) {
      const state = await loadAdminState();
      if (!state.ok) return state;
      const guest = state.data.guests.find((item) => item.id === id);
      if (!guest) return fail("Guest not found.");
      const extra = guest.table === tableId ? 0 : partySize(guest);
      const table = state.data.tables.find((item) => item.id === tableId);
      if (!table) return fail("Table not found.");
      if (occupiedSeats(state.data.guests, tableId) + extra > table.capacity) {
        return fail(`${table.name} does not have enough seats for this party.`);
      }
    }
    return patchGuest(id, { table_id: tableId }, supabase);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}

export async function updateGuestCategory(
  id: number,
  category: string,
): Promise<ActionResult<Guest>> {
  return patchGuest(id, { category: clean(category, 60) || "Uncategorised" });
}

export async function createGuest(input: {
  name: string;
  category: string;
  seats: number;
  plusOne: boolean;
}): Promise<ActionResult<Guest>> {
  try {
    const supabase = await adminClient();
    const name = clean(input.name);
    const seats = Number(input.seats);
    if (!name || !Number.isInteger(seats) || seats < 1 || seats > 12) {
      return fail("A name and 1–12 reserved seats are required.");
    }
    const category = clean(input.category, 60) || "Uncategorised";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = `WP-${Math.floor(1000 + Math.random() * 9000)}`;
      const { data, error } = await supabase
        .from("guests")
        .insert({
          invitation_code: code,
          name,
          category,
          reserved_seats: seats,
          plus_one_allowed: Boolean(input.plusOne),
        })
        .select(GUEST_COLUMNS)
        .single();
      if (!error && data) return ok(mapGuest(data as GuestRow));
      if (error && error.code !== "23505") return fail(error.message);
    }
    return fail("Could not create a unique invitation code. Please try again.");
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}

export async function createTable(): Promise<ActionResult<ReceptionTable>> {
  try {
    const supabase = await adminClient();
    const state = await loadAdminState();
    if (!state.ok) return state;
    const name = `Table ${state.data.tables.length + 1}`;
    const { data, error } = await supabase
      .from("reception_tables")
      .insert({ name, capacity: 10 })
      .select("id, name, capacity")
      .single();
    if (error || !data) return fail(error?.message ?? "Could not add a table.");
    return ok(mapTable(data as TableRow));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}

export async function updateTableCapacity(
  id: number,
  capacity: number,
): Promise<ActionResult<ReceptionTable>> {
  try {
    const supabase = await adminClient();
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 30) {
      return fail("Capacity must be between 1 and 30.");
    }
    const state = await loadAdminState();
    if (!state.ok) return state;
    const seated = occupiedSeats(state.data.guests, id);
    if (capacity < seated) {
      return fail(`Capacity cannot be below the ${seated} seats already assigned.`);
    }
    const { data, error } = await supabase
      .from("reception_tables")
      .update({ capacity })
      .eq("id", id)
      .select("id, name, capacity")
      .single();
    if (error || !data) return fail(error?.message ?? "Table not found.");
    return ok(mapTable(data as TableRow));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}

export async function autoAssignTables(): Promise<
  ActionResult<{ guests: Guest[]; tables: ReceptionTable[] }>
> {
  try {
    const supabase = await adminClient();
    const state = await loadAdminState();
    if (!state.ok) return state;
    const guests = state.data.guests.map((guest) => ({ ...guest }));
    const updates: Array<{ id: number; table_id: number }> = [];
    for (const guest of guests.filter(
      (item) => !item.table && (item.ceremony || item.reception),
    )) {
      const table = state.data.tables.find(
        (item) => occupiedSeats(guests, item.id) + partySize(guest) <= item.capacity,
      );
      if (!table) continue;
      guest.table = table.id;
      updates.push({ id: guest.id, table_id: table.id });
    }
    for (const update of updates) {
      const { error } = await supabase
        .from("guests")
        .update({ table_id: update.table_id, updated_at: new Date().toISOString() })
        .eq("id", update.id);
      if (error) return fail(error.message);
    }
    return loadAdminState();
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}

async function patchGuest(
  id: number,
  values: Record<string, unknown>,
  client?: Awaited<ReturnType<typeof createClient>>,
): Promise<ActionResult<Guest>> {
  try {
    const supabase = client ?? (await adminClient());
    const { data, error } = await supabase
      .from("guests")
      .update({ ...values, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(GUEST_COLUMNS)
      .single();
    if (error || !data) return fail(error?.message ?? "Guest not found.");
    return ok(mapGuest(data as GuestRow));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Request failed.");
  }
}
