"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { loginAdmin } from "@/app/actions";
import {
  deleteGuest,
  deleteTable,
  getAdminEmail,
  loadDashboard,
  saveGuest,
  saveTable,
  signOutAdmin,
  type GuestInput,
  type TableInput,
} from "@/app/admin/actions";
import { RSVP_LABELS, occupiedSeats, partySize, rsvpStatus } from "@/lib/domain";
import {
  CATEGORIES,
  type DashboardGuest,
  type ReceptionTable,
  type RsvpStatus,
} from "@/lib/types";

type Tab = "guests" | "tables";
type StatusFilter = RsvpStatus | "checked" | "";

const EMPTY_GUEST: GuestInput = {
  name: "",
  category: CATEGORIES[0],
  seats: 1,
  plusOne: false,
  plusOneName: "",
  rsvp: "pending",
  table: null,
  checked: false,
};

const EMPTY_TABLE: TableInput = { name: "", capacity: 10 };

function toCsv(guests: DashboardGuest[], tables: ReceptionTable[]): string {
  const header = [
    "Code",
    "Name",
    "Category",
    "Reserved seats",
    "Plus-one",
    "RSVP",
    "Table",
    "Checked in",
  ];
  const rows = guests.map((guest) => [
    guest.code,
    guest.name,
    guest.category,
    String(guest.seats),
    guest.plusOneName,
    RSVP_LABELS[rsvpStatus(guest)],
    tables.find((table) => table.id === guest.table)?.name ?? "",
    guest.checked ? "Yes" : "No",
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
    .join("\n");
}

export function AdminDashboard() {
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [guests, setGuests] = useState<DashboardGuest[]>([]);
  const [tables, setTables] = useState<ReceptionTable[]>([]);
  const [tab, setTab] = useState<Tab>("guests");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [editingGuestId, setEditingGuestId] = useState<number | null>(null);
  const [guestForm, setGuestForm] = useState<GuestInput>(EMPTY_GUEST);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [tableForm, setTableForm] = useState<TableInput>(EMPTY_TABLE);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const guestDialog = useRef<HTMLDialogElement>(null);
  const tableDialog = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2500);
  }, []);

  const reload = useCallback(async () => {
    const result = await loadDashboard();
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    setGuests(result.data.guests);
    setTables(result.data.tables);
  }, [showToast]);

  useEffect(() => {
    let active = true;
    void getAdminEmail().then(async (current) => {
      if (!active) return;
      setAdminEmail(current);
      setAuthChecked(true);
      if (current) await reload();
    });
    return () => {
      active = false;
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, [reload]);

  const stats = useMemo(() => {
    const statuses = guests.map((guest) => ({ guest, status: rsvpStatus(guest) }));
    const people = (list: typeof statuses) =>
      list.reduce((total, { guest }) => total + partySize(guest), 0);
    const attending = statuses.filter(
      ({ status }) => status === "attending" || status === "ceremony",
    );
    return {
      invitations: guests.length,
      invitedSeats: guests.reduce((total, guest) => total + guest.seats, 0),
      attendingPeople: people(attending),
      receptionPeople: people(statuses.filter(({ guest }) => guest.reception)),
      pending: statuses.filter(({ status }) => status === "pending").length,
      declined: statuses.filter(({ status }) => status === "declined").length,
      checkedInPeople: people(statuses.filter(({ guest }) => guest.checked)),
      seated: people(statuses.filter(({ guest }) => guest.table)),
      capacity: tables.reduce((total, table) => total + table.capacity, 0),
    };
  }, [guests, tables]);

  const filteredGuests = useMemo(
    () =>
      guests.filter((guest) => {
        const matchesSearch = `${guest.name} ${guest.code} ${guest.plusOneName}`
          .toLowerCase()
          .includes(search.toLowerCase());
        const matchesStatus =
          !statusFilter ||
          (statusFilter === "checked" ? guest.checked : rsvpStatus(guest) === statusFilter);
        const matchesCategory = !categoryFilter || guest.category === categoryFilter;
        return matchesSearch && matchesStatus && matchesCategory;
      }),
    [guests, search, statusFilter, categoryFilter],
  );

  const tableName = (id: number | null) =>
    tables.find((table) => table.id === id)?.name ?? "—";

  const run = async (
    action: () => Promise<{ ok: true } | { ok: false; error: string }>,
    success: string,
  ) => {
    setBusy(true);
    const result = await action();
    if (result.ok) {
      await reload();
      showToast(success);
    } else {
      showToast(result.error);
    }
    setBusy(false);
    return result.ok;
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    const result = await loginAdmin(email, password);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    setAdminEmail(result.data.email);
    setPassword("");
    await reload();
  };

  const handleSignOut = async () => {
    await signOutAdmin();
    setAdminEmail(null);
    setGuests([]);
    setTables([]);
  };

  const openGuest = (guest?: DashboardGuest) => {
    setEditingGuestId(guest?.id ?? null);
    setGuestForm(
      guest
        ? {
            name: guest.name,
            category: guest.category,
            seats: guest.seats,
            plusOne: guest.plusOne,
            plusOneName: guest.plusOneName,
            rsvp: rsvpStatus(guest),
            table: guest.table,
            checked: guest.checked,
          }
        : EMPTY_GUEST,
    );
    guestDialog.current?.showModal();
  };

  const openTable = (table?: ReceptionTable) => {
    setEditingTableId(table?.id ?? null);
    setTableForm(
      table
        ? { name: table.name, capacity: table.capacity }
        : { name: `Table ${tables.length + 1}`, capacity: 10 },
    );
    tableDialog.current?.showModal();
  };

  const handleSaveGuest = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run(
      () => saveGuest(editingGuestId, guestForm),
      editingGuestId ? "Guest updated" : "Guest added",
    );
    if (saved) guestDialog.current?.close();
  };

  const handleSaveTable = async (event: FormEvent) => {
    event.preventDefault();
    const saved = await run(
      () => saveTable(editingTableId, tableForm),
      editingTableId ? "Table updated" : "Table added",
    );
    if (saved) tableDialog.current?.close();
  };

  const handleDeleteGuest = async (guest: DashboardGuest) => {
    if (!window.confirm(`Delete ${guest.name} (${guest.code})? This cannot be undone.`)) return;
    await run(() => deleteGuest(guest.id), `${guest.name} deleted`);
  };

  const handleDeleteTable = async (table: ReceptionTable) => {
    const seated = guests.filter((guest) => guest.table === table.id).length;
    const warning = seated ? ` ${seated} guest(s) will become unassigned.` : "";
    if (!window.confirm(`Delete ${table.name}?${warning}`)) return;
    await run(() => deleteTable(table.id), `${table.name} deleted`);
  };

  const exportCsv = () => {
    const blob = new Blob([toCsv(guests, tables)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "guest-list.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const toastEl = (
    <div id="toast" className={toastVisible ? "show" : ""} role="status">
      {toast}
    </div>
  );

  if (!authChecked) {
    return <main className="site-shell cms-loading">Loading dashboard…</main>;
  }

  if (!adminEmail) {
    return (
      <main className="site-shell">
        <header className="topbar">
          <Link className="brand" href="/">
            <span>Ever</span> After
          </Link>
        </header>
        <section className="rsvp-card cms-login">
          <p className="eyebrow">ADMIN DASHBOARD</p>
          <h2>Sign in</h2>
          <p>Sign in to manage guests and tables.</p>
          <form onSubmit={handleLogin}>
            <label htmlFor="cmsEmail">Email address</label>
            <input
              id="cmsEmail"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <label htmlFor="cmsPassword">Password</label>
            <input
              id="cmsPassword"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button className="primary wide" type="submit">
              Open dashboard
            </button>
          </form>
        </section>
        {toastEl}
      </main>
    );
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span>Ever</span> After
        </Link>
        <nav aria-label="Admin">
          <Link className="nav-link" href="/">
            Guest site
          </Link>
          <span className="cms-user">{adminEmail}</span>
          <button className="nav-link" type="button" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </nav>
      </header>

      <div className="admin-heading">
        <div>
          <p className="eyebrow">WINSTON &amp; POKUA · 28 NOV 2026</p>
          <h1>Dashboard</h1>
        </div>
        <div className="admin-actions">
          <button className="secondary" type="button" onClick={() => void reload()}>
            Refresh
          </button>
          <button className="secondary" type="button" onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="stats cms-stats" aria-label="Summary">
        <article>
          <small>INVITATIONS</small>
          <strong>{stats.invitations}</strong>
          <span>{stats.invitedSeats} seats reserved</span>
        </article>
        <article>
          <small>ATTENDING</small>
          <strong>{stats.attendingPeople}</strong>
          <span>{stats.receptionPeople} at reception</span>
        </article>
                    <article>
          <small>NOT CONFIRMED</small>
          <strong>{stats.pending}</strong>
          <span>{stats.declined} declined</span>
        </article>
        <article>
          <small>CHECKED IN</small>
          <strong>{stats.checkedInPeople}</strong>
          <span>of {stats.attendingPeople} attending</span>
        </article>
        <article>
          <small>SEATED</small>
          <strong>
            {stats.seated}/{stats.capacity}
          </strong>
          <span>{tables.length} tables</span>
        </article>
      </div>

      <div className="cms-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "guests"}
          className={tab === "guests" ? "active" : ""}
          onClick={() => setTab("guests")}
        >
          Guests &amp; reservations ({guests.length})
        </button>
        <button
          role="tab"
          aria-selected={tab === "tables"}
          className={tab === "tables" ? "active" : ""}
          onClick={() => setTab("tables")}
        >
          Tables ({tables.length})
        </button>
      </div>

      {tab === "guests" ? (
        <section className="panel">
          <div className="cms-toolbar">
            <input
              placeholder="Search name, code, or plus-one…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <select
              aria-label="Filter by RSVP"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="">All RSVPs</option>
              {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((status) => (
                <option key={status} value={status}>
                  {RSVP_LABELS[status]}
                </option>
              ))}
              <option value="checked">Checked in</option>
            </select>
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
            >
              <option value="">All categories</option>
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
            <button className="primary" type="button" onClick={() => openGuest()}>
              + Add guest
            </button>
          </div>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Code</th>
                  <th>Category</th>
                  <th>Party</th>
                  <th>RSVP</th>
                  <th>Table</th>
                  <th>Checked in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filteredGuests.map((guest) => {
                  const status = rsvpStatus(guest);
                  return (
                    <tr key={guest.id}>
                      <td>
                        <strong>{guest.name}</strong>
                        {guest.plusOneName ? <small>+ {guest.plusOneName}</small> : null}
                      </td>
                      <td>{guest.code}</td>
                      <td>{guest.category}</td>
                      <td>{partySize(guest)}</td>
                      <td>
                        <span className={`cms-badge ${status}`}>{RSVP_LABELS[status]}</span>
                      </td>
                      <td>{tableName(guest.table)}</td>
                      <td>{guest.checked ? "✓" : "—"}</td>
                      <td className="cms-row-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openGuest(guest)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cms-delete"
                          onClick={() => void handleDeleteGuest(guest)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredGuests.length ? null : <p className="guest-meta">No guests match.</p>}
          </div>
        </section>
      ) : (
        <section className="panel">
          <div className="cms-toolbar">
            <p className="guest-meta">
              {stats.seated} of {stats.capacity} seats assigned
            </p>
            <button className="primary" type="button" onClick={() => openTable()}>
              + Add table
            </button>
          </div>
          <div className="cms-table-wrap">
            <table className="cms-table">
              <thead>
                <tr>
                  <th>Table</th>
                  <th>Seats used</th>
                  <th>Guests</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tables.map((table) => {
                  const used = occupiedSeats(guests, table.id);
                  return (
                    <tr key={table.id}>
                      <td>
                        <strong>{table.name}</strong>
                      </td>
                      <td>
                        {used} / {table.capacity}
                        <div className="meter">
                          <i style={{ width: `${Math.min(100, (used / table.capacity) * 100)}%` }} />
                        </div>
                      </td>
                      <td>
                        {guests
                          .filter((guest) => guest.table === table.id)
                          .map((guest) => guest.name)
                          .join(", ") || "—"}
                      </td>
                      <td className="cms-row-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => openTable(table)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="cms-delete"
                          onClick={() => void handleDeleteTable(table)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <dialog ref={guestDialog} className="modal">
        <form onSubmit={handleSaveGuest}>
          <p className="eyebrow">{editingGuestId ? "EDIT GUEST" : "NEW GUEST"}</p>
          <h2>{editingGuestId ? guestForm.name || "Guest" : "Add a guest"}</h2>
          <label htmlFor="cmsName">Guest or family name</label>
          <input
            id="cmsName"
            required
            value={guestForm.name}
            onChange={(event) => setGuestForm({ ...guestForm, name: event.target.value })}
          />
          <div className="cms-grid">
            <div>
              <label htmlFor="cmsCategory">Category</label>
              <select
                id="cmsCategory"
                value={guestForm.category}
                onChange={(event) => setGuestForm({ ...guestForm, category: event.target.value })}
              >
                {guestForm.category === "Uncategorised" ? <option>Uncategorised</option> : null}
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cmsSeats">Reserved seats</label>
              <input
                id="cmsSeats"
                type="number"
                min={1}
                max={12}
                required
                value={guestForm.seats}
                onChange={(event) =>
                  setGuestForm({ ...guestForm, seats: Number(event.target.value) })
                }
              />
            </div>
            <div>
              <label htmlFor="cmsRsvp">RSVP</label>
              <select
                id="cmsRsvp"
                value={guestForm.rsvp}
                onChange={(event) =>
                  setGuestForm({ ...guestForm, rsvp: event.target.value as RsvpStatus })
                }
              >
                {(Object.keys(RSVP_LABELS) as RsvpStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {RSVP_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="cmsTable">Table</label>
              <select
                id="cmsTable"
                value={guestForm.table ?? ""}
                onChange={(event) =>
                  setGuestForm({
                    ...guestForm,
                    table: event.target.value ? Number(event.target.value) : null,
                  })
                }
              >
                <option value="">Unassigned</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="choice">
            <input
              type="checkbox"
              checked={guestForm.plusOne}
              onChange={(event) => setGuestForm({ ...guestForm, plusOne: event.target.checked })}
            />
            <span>May bring a plus-one</span>
          </label>
          {guestForm.plusOne && guestForm.rsvp === "attending" ? (
            <>
              <label htmlFor="cmsPlusOne">Plus-one name</label>
              <input
                id="cmsPlusOne"
                value={guestForm.plusOneName}
                onChange={(event) =>
                  setGuestForm({ ...guestForm, plusOneName: event.target.value })
                }
              />
            </>
          ) : null}
          <label className="choice">
            <input
              type="checkbox"
              checked={guestForm.checked}
              onChange={(event) => setGuestForm({ ...guestForm, checked: event.target.checked })}
            />
            <span>Checked in</span>
          </label>
          <button className="primary wide" type="submit" disabled={busy}>
            {editingGuestId ? "Save changes" : "Create invitation"}
          </button>
          <button
            type="button"
            className="close-modal"
            onClick={() => guestDialog.current?.close()}
          >
            Cancel
          </button>
        </form>
      </dialog>

      <dialog ref={tableDialog} className="modal">
        <form onSubmit={handleSaveTable}>
          <p className="eyebrow">{editingTableId ? "EDIT TABLE" : "NEW TABLE"}</p>
          <h2>{editingTableId ? tableForm.name || "Table" : "Add a table"}</h2>
          <label htmlFor="cmsTableName">Name</label>
          <input
            id="cmsTableName"
            required
            value={tableForm.name}
            onChange={(event) => setTableForm({ ...tableForm, name: event.target.value })}
          />
          <label htmlFor="cmsCapacity">Seat capacity</label>
          <input
            id="cmsCapacity"
            type="number"
            min={1}
            max={30}
            required
            value={tableForm.capacity}
            onChange={(event) =>
              setTableForm({ ...tableForm, capacity: Number(event.target.value) })
            }
          />
          <button className="primary wide" type="submit" disabled={busy}>
            {editingTableId ? "Save changes" : "Add table"}
          </button>
          <button
            type="button"
            className="close-modal"
            onClick={() => tableDialog.current?.close()}
          >
            Cancel
          </button>
        </form>
      </dialog>

      {toastEl}
    </main>
  );
}
