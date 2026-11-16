"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  assignGuestTable,
  autoAssignTables,
  checkInGuest,
  createGuest,
  createTable,
  loadAdminState,
  loginAdmin,
  lookupInvitation,
  submitRsvp,
  updateGuestCategory,
  updateTableCapacity,
} from "@/app/actions";
import { initials, occupiedSeats, partySize } from "@/lib/domain";
import { CATEGORIES, type Guest, type ReceptionTable } from "@/lib/types";

type View = "rsvp" | "admin";
type RsvpStep = "lookup" | "form" | "confirmation";

type BarcodeMatch = { rawValue: string };

type BarcodeDetectorInstance = {
  detect: (source: CanvasImageSource) => Promise<BarcodeMatch[]>;
};

type BarcodeDetectorCtor = new (options: {
  formats: string[];
}) => BarcodeDetectorInstance;

function confirmationCopy(guest: Guest): { title: string; message: string } {
  if (guest.ceremony && guest.reception) {
    return {
      title: "We can’t wait to celebrate!",
      message:
        "Your response has been recorded. Your table details will be available at the reception.",
    };
  }
  if (guest.ceremony) {
    return {
      title: "We look forward to seeing you at the ceremony!",
      message:
        "Your response has been recorded. Thank you for joining Winston and Pokua for this special moment.",
    };
  }
  return {
    title: "We’ll miss celebrating with you",
    message:
      "Thank you for letting us know. Winston and Pokua will miss you, and truly appreciate your good wishes.",
  };
}

export function WeddingApp() {
  const [view, setView] = useState<View>("rsvp");
  const [rsvpStep, setRsvpStep] = useState<RsvpStep>("lookup");
  const [code, setCode] = useState("");
  const [guest, setGuest] = useState<Guest | null>(null);
  const [ceremony, setCeremony] = useState(true);
  const [reception, setReception] = useState(true);
  const [plusOneName, setPlusOneName] = useState("");
  const [confirmation, setConfirmation] = useState({ title: "", message: "" });
  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<ReceptionTable[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [cameraStatus, setCameraStatus] = useState(
    "Camera scanner ready when supported",
  );
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);
  const [newSeats, setNewSeats] = useState(1);
  const [newPlus, setNewPlus] = useState(false);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [tableCapacity, setTableCapacity] = useState(10);
  const [assignGuestId, setAssignGuestId] = useState<number | "">("");
  const loginDialog = useRef<HTMLDialogElement>(null);
  const qrDialog = useRef<HTMLDialogElement>(null);
  const guestDialog = useRef<HTMLDialogElement>(null);
  const tableDialog = useRef<HTMLDialogElement>(null);
  const toastTimer = useRef<number | null>(null);

  const showToast = (message: string) => {
    setToast(message);
    setToastVisible(true);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastVisible(false), 2500);
  };

  const replaceGuest = (updated: Guest) => {
    setGuests((current) => {
      const index = current.findIndex((item) => item.id === updated.id);
      if (index < 0) return [...current, updated];
      return current.map((item) => (item.id === updated.id ? updated : item));
    });
    setGuest((current) => (current?.id === updated.id ? updated : current));
  };

  const showPlusOne = Boolean(guest?.plusOne && ceremony && reception);
  const showReception = ceremony;
  const editingTable = tables.find((table) => table.id === editingTableId) ?? null;
  const assignedToEditor = guests.filter((item) => item.table === editingTableId);

  const filteredGuests = useMemo(
    () =>
      guests.filter(
        (item) =>
          `${item.name}${item.code}`
            .toLowerCase()
            .includes(search.toLowerCase()) &&
          (!categoryFilter || item.category === categoryFilter),
      ),
    [guests, search, categoryFilter],
  );

  const invited = guests.reduce((total, item) => total + item.seats, 0);
  const confirmed = guests.filter((item) => item.ceremony || item.reception).length;
  const checkedIn = guests.filter((item) => item.checked).length;
  const assignedSeats = guests.reduce(
    (total, item) => total + (item.table ? partySize(item) : 0),
    0,
  );
  const totalCapacity = tables.reduce((total, table) => total + table.capacity, 0);

  useEffect(() => {
    return () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const openAdmin = async () => {
    const result = await loadAdminState();
    if (!result.ok) {
      loginDialog.current?.showModal();
      showToast(result.error);
      return;
    }
    setGuests(result.data.guests);
    setTables(result.data.tables);
    setView("admin");
  };

  const handleLookup = async (event: FormEvent) => {
    event.preventDefault();
    const result = await lookupInvitation(code);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    setGuest(result.data);
    setCeremony(result.data.ceremony);
    setReception(result.data.reception);
    setPlusOneName(result.data.plusOneName);
    setRsvpStep("form");
  };

  const handleRsvp = async (event: FormEvent) => {
    event.preventDefault();
    if (!guest) return;
    const nextCeremony = ceremony;
    const nextReception = nextCeremony && reception;
    const result = await submitRsvp({
      code: guest.code,
      ceremony: nextCeremony,
      reception: nextReception,
      plusOneName: guest.plusOne && nextReception ? plusOneName.trim() : "",
    });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    replaceGuest(result.data);
    setConfirmation(confirmationCopy(result.data));
    setRsvpStep("confirmation");
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    const result = await loginAdmin(adminEmail, adminPassword);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    loginDialog.current?.close();
    await openAdmin();
  };

  const handleCheckIn = async (id: number) => {
    const result = await checkInGuest(id);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    replaceGuest(result.data);
    showToast(`${result.data.name} checked in`);
  };

  const handleAssign = async (id: number, tableId: number | null) => {
    const result = await assignGuestTable(id, tableId);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    replaceGuest(result.data);
    showToast(`${result.data.name} assignment updated`);
  };

  const handleCategory = async (id: number, category: string) => {
    const result = await updateGuestCategory(id, category);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    replaceGuest(result.data);
    showToast(`${result.data.name} category updated`);
  };

  const handleQrLookup = async (event: FormEvent) => {
    event.preventDefault();
    const result = await lookupInvitation(qrCode);
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    qrDialog.current?.close();
    setSearch(result.data.code);
    await openAdmin();
    showToast(`${result.data.name} found — ready to check in`);
  };

  const handleCameraScan = async () => {
    const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    if (!Detector) {
      showToast("Camera scanning is not available here. Enter the invitation code instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setCameraStatus("Camera opened. Hold the QR code in view.");
      const detector = new Detector({ formats: ["qr_code"] });
      const video = document.createElement("video");
      video.srcObject = stream;
      await video.play();
      const timer = window.setInterval(async () => {
        const found = await detector.detect(video);
        if (found[0]) {
          window.clearInterval(timer);
          stream.getTracks().forEach((track) => track.stop());
          setQrCode(found[0].rawValue);
          showToast("QR code captured");
        }
      }, 400);
    } catch {
      showToast("Camera access was not granted. Enter the invitation code instead.");
    }
  };

  const handleAddGuest = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createGuest({
      name: newName,
      category: newCategory,
      seats: newSeats,
      plusOne: newPlus,
    });
    if (!result.ok) {
      showToast(result.error);
      return;
    }
    replaceGuest(result.data);
    guestDialog.current?.close();
    setNewName("");
    setNewCategory(CATEGORIES[0]);
    setNewSeats(1);
    setNewPlus(false);
    showToast(`${result.data.name} added — invitation ${result.data.code}`);
  };

  const openTableEditor = (table: ReceptionTable) => {
    setEditingTableId(table.id);
    setTableCapacity(table.capacity);
    setAssignGuestId(guests[0]?.id ?? "");
    tableDialog.current?.showModal();
  };

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#">
          <span>Ever</span> After
        </a>
        <nav aria-label="Primary">
          <button
            className={`nav-link${view === "rsvp" ? " active" : ""}`}
            type="button"
            onClick={() => setView("rsvp")}
          >
            RSVP
          </button>
          <button
            className={`nav-link${view === "admin" ? " active" : ""}`}
            type="button"
            onClick={() => {
              void openAdmin();
            }}
          >
            Admin desk
          </button>
        </nav>
      </header>

      {view === "rsvp" ? (
        <section className="view">
          <div className="hero-copy">
            <p className="eyebrow">SATURDAY · 28 NOVEMBER 2026</p>
            <h1>
              Celebrate with
              <br />
              <em>Winston &amp; Pokua</em>
            </h1>
            <p className="intro">
              We would be delighted to have you with us. Please let us know if you
              will be joining the ceremony and reception.
            </p>
          </div>
          <section className="rsvp-card" aria-labelledby="rsvpHeading">
            {rsvpStep === "lookup" ? (
              <div>
                <p className="eyebrow">YOUR INVITATION</p>
                <h2 id="rsvpHeading">Find your invitation</h2>
                <p>Enter your invitation code to respond.</p>
                <form onSubmit={handleLookup}>
                  <label htmlFor="code">Invitation code</label>
                  <div className="input-row">
                    <input
                      id="code"
                      autoComplete="off"
                      placeholder="Invitation code"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                    />
                    <button className="primary" type="submit">
                      Continue <span>→</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : null}

            {rsvpStep === "form" && guest ? (
              <form onSubmit={handleRsvp}>
                <p className="eyebrow">WELCOME</p>
                <h2>{guest.name}</h2>
                <p className="party-note">
                  Your invitation reserves{" "}
                  <strong>
                    {guest.seats} seat{guest.seats === 1 ? "" : "s"}
                  </strong>
                  .
                </p>
                <fieldset>
                  <legend>Will you attend the ceremony?</legend>
                  <label className="choice">
                    <input
                      type="radio"
                      name="ceremony"
                      checked={ceremony}
                      onChange={() => {
                        setCeremony(true);
                      }}
                    />
                    <span>Joyfully accepts</span>
                  </label>
                  <label className="choice">
                    <input
                      type="radio"
                      name="ceremony"
                      checked={!ceremony}
                      onChange={() => {
                        setCeremony(false);
                        setReception(false);
                      }}
                    />
                    <span>Regretfully declines</span>
                  </label>
                </fieldset>
                {showReception ? (
                  <fieldset>
                    <legend>Will you join the reception?</legend>
                    <label className="choice">
                      <input
                        type="radio"
                        name="reception"
                        checked={reception}
                        onChange={() => setReception(true)}
                      />
                      <span>Yes, save us a seat</span>
                    </label>
                    <label className="choice">
                      <input
                        type="radio"
                        name="reception"
                        checked={!reception}
                        onChange={() => setReception(false)}
                      />
                      <span>No, thank you</span>
                    </label>
                  </fieldset>
                ) : null}
                {guest.plusOne ? (
                  <div className={showPlusOne ? "" : "field-disabled"}>
                    <label htmlFor="plusOne">Name of your guest</label>
                    <input
                      id="plusOne"
                      placeholder="Your guest’s full name"
                      value={plusOneName}
                      disabled={!showPlusOne}
                      onChange={(event) => setPlusOneName(event.target.value)}
                    />
                  </div>
                ) : null}
                <button className="primary wide" type="submit">
                  Confirm response <span>→</span>
                </button>
              </form>
            ) : null}

            {rsvpStep === "confirmation" ? (
              <div className="confirmation">
                <div className="check">✓</div>
                <p className="eyebrow">RESPONSE SAVED</p>
                <h2>{confirmation.title}</h2>
                <p>{confirmation.message}</p>
                <button
                  className="secondary"
                  type="button"
                  onClick={() => setRsvpStep("form")}
                >
                  Update response
                </button>
              </div>
            ) : null}
          </section>
        </section>
      ) : (
        <section className="view">
          <div className="admin-heading">
            <div>
              <p className="eyebrow">WINSTON &amp; POKUA · 28 NOV 2026</p>
              <h1>Reception desk</h1>
            </div>
            <div className="admin-actions">
              <button
                className="secondary"
                type="button"
                onClick={() => qrDialog.current?.showModal()}
              >
                Scan / enter QR
              </button>
              <button
                className="primary"
                type="button"
                onClick={async () => {
                  const result = await autoAssignTables();
                  if (!result.ok) {
                    showToast(result.error);
                    return;
                  }
                  setGuests(result.data.guests);
                  setTables(result.data.tables);
                  showToast("Unassigned guests have been seated");
                }}
              >
                Auto-assign tables <span>✦</span>
              </button>
            </div>
          </div>
          <div className="stats" aria-label="Guest statistics">
            <article>
              <small>INVITED</small>
              <strong>{invited}</strong>
            </article>
            <article>
              <small>CONFIRMED</small>
              <strong>{confirmed}</strong>
            </article>
            <article>
              <small>CHECKED IN</small>
              <strong>{checkedIn}</strong>
            </article>
            <article>
              <small>TABLES</small>
              <strong>{tables.length}</strong>
            </article>
          </div>
          <div className="admin-grid">
            <section className="panel guests-panel">
              <div className="panel-title">
                <div>
                  <h2>Guest check-in</h2>
                  <p>Search by guest name or invitation code.</p>
                </div>
                <span className="live-dot">Live</span>
              </div>
              <label className="search">
                <span>⌕</span>
                <input
                  placeholder="Search guests…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <label className="category-filter" htmlFor="categoryFilter">
                Guest category
                <select
                  id="categoryFilter"
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <option value="">All categories</option>
                  {CATEGORIES.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>
              </label>
              <div className="guest-list">
                {filteredGuests.length ? (
                  filteredGuests.map((item) => (
                    <div className="guest-row" key={item.id}>
                      <div className="avatar">{initials(item.name)}</div>
                      <div>
                        <div className="guest-name">{item.name}</div>
                        <div className="guest-meta">
                          {item.code} · Party of {partySize(item)}
                          {item.table
                            ? ` · ${tables.find((table) => table.id === item.table)?.name ?? `Table ${item.table}`}`
                            : " · Unassigned"}
                        </div>
                        <select
                          className="category-edit"
                          aria-label={`Category for ${item.name}`}
                          value={item.category}
                          onChange={(event) =>
                            void handleCategory(item.id, event.target.value)
                          }
                        >
                          {item.category === "Uncategorised" ? (
                            <option>Uncategorised</option>
                          ) : null}
                          {CATEGORIES.map((category) => (
                            <option key={category}>{category}</option>
                          ))}
                        </select>
                      </div>
                      <select
                        className="table-select"
                        aria-label={`Assign ${item.name} to a table`}
                        value={item.table ?? ""}
                        onChange={(event) =>
                          void handleAssign(
                            item.id,
                            event.target.value ? Number(event.target.value) : null,
                          )
                        }
                      >
                        <option value="">Unassigned</option>
                        {tables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {table.name}
                          </option>
                        ))}
                      </select>
                      {item.checked ? (
                        <span className="status checked">✓ Checked in</span>
                      ) : (
                        <button
                          className="checkin"
                          type="button"
                          onClick={() => void handleCheckIn(item.id)}
                        >
                          Check in
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="guest-meta">No guests found.</p>
                )}
              </div>
              <button
                className="secondary panel-action"
                type="button"
                onClick={() => guestDialog.current?.showModal()}
              >
                + Add guest
              </button>
            </section>
            <section className="panel tables-panel">
              <div className="panel-title">
                <div>
                  <h2>Table assignments</h2>
                  <p>
                    {tables.length} tables · {assignedSeats} of {totalCapacity} seats
                    assigned
                  </p>
                </div>
                <button
                  className="secondary"
                  type="button"
                  onClick={async () => {
                    const result = await createTable();
                    if (!result.ok) {
                      showToast(result.error);
                      return;
                    }
                    setTables((current) => [...current, result.data]);
                    showToast("A new table has been added");
                  }}
                >
                  + Table
                </button>
              </div>
              <div className="table-list">
                {tables.map((table) => {
                  const count = occupiedSeats(guests, table.id);
                  const names =
                    guests
                      .filter((item) => item.table === table.id)
                      .map((item) => item.name.replace("Mr. & Mrs. ", ""))
                      .join(", ") || "No guests assigned";
                  return (
                    <article
                      className="table"
                      key={table.id}
                      onClick={() => openTableEditor(table)}
                    >
                      <div className="table-top">
                        <b>{table.name}</b>
                        <span>
                          {count} / {table.capacity} seats
                        </span>
                      </div>
                      <div className="meter">
                        <i
                          style={{
                            width: `${Math.min(100, (count / table.capacity) * 100)}%`,
                          }}
                        />
                      </div>
                      <div className="table-guests">{names}</div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      )}

      <dialog ref={loginDialog} className="modal">
        <form onSubmit={handleLogin}>
          <p className="eyebrow">RECEPTION TEAM</p>
          <h2>Admin access</h2>
          <p>Sign in to manage arrivals and tables.</p>
          <label htmlFor="adminEmail">Email address</label>
          <input
            id="adminEmail"
            type="email"
            autoComplete="email"
            placeholder="admin@example.com"
            value={adminEmail}
            onChange={(event) => setAdminEmail(event.target.value)}
          />
          <label htmlFor="passcode">Password</label>
          <input
            id="passcode"
            type="password"
            autoComplete="current-password"
            placeholder="Enter password"
            value={adminPassword}
            onChange={(event) => setAdminPassword(event.target.value)}
          />
          <button className="primary wide" type="submit">
            Open reception desk
          </button>
          <button
            type="button"
            className="close-modal"
            onClick={() => loginDialog.current?.close()}
          >
            Cancel
          </button>
        </form>
      </dialog>

      <dialog ref={qrDialog} className="modal">
        <form onSubmit={handleQrLookup}>
          <p className="eyebrow">QR CHECK-IN</p>
          <h2>Find an invitation</h2>
          <p>
            Use the camera scanner where supported, or enter the code beneath the QR
            card.
          </p>
          <div className="camera-box">
            {cameraStatus}
            <br />
            <button
              type="button"
              className="secondary"
              onClick={() => void handleCameraScan()}
            >
              Use camera
            </button>
          </div>
          <label htmlFor="qrCode">Invitation code</label>
          <input
            id="qrCode"
            autoComplete="off"
            placeholder="Invitation code"
            value={qrCode}
            onChange={(event) => setQrCode(event.target.value)}
          />
          <button className="primary wide" type="submit">
            Find guest
          </button>
          <button
            type="button"
            className="close-modal"
            onClick={() => qrDialog.current?.close()}
          >
            Cancel
          </button>
        </form>
      </dialog>

      <dialog ref={guestDialog} className="modal">
        <form onSubmit={handleAddGuest}>
          <p className="eyebrow">NEW INVITATION</p>
          <h2>Add a guest</h2>
          <label htmlFor="newName">Guest or family name</label>
          <input
            id="newName"
            required
            placeholder="e.g. Adwoa Mensima"
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
          />
          <label htmlFor="newCategory">Guest category</label>
          <select
            id="newCategory"
            required
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
          >
            {CATEGORIES.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
          <label htmlFor="newSeats">Reserved seats</label>
          <input
            id="newSeats"
            type="number"
            required
            min={1}
            max={12}
            value={newSeats}
            onChange={(event) => setNewSeats(Number(event.target.value))}
          />
          <label className="choice">
            <input
              type="checkbox"
              checked={newPlus}
              onChange={(event) => setNewPlus(event.target.checked)}
            />
            <span>May bring a plus-one</span>
          </label>
          <button className="primary wide" type="submit">
            Create invitation
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
        <form onSubmit={(event) => event.preventDefault()}>
          <p className="eyebrow">TABLE EDITOR</p>
          <h2>{editingTable?.name ?? "Table"}</h2>
          <label htmlFor="tableCapacity">Seat capacity</label>
          <input
            id="tableCapacity"
            type="number"
            min={1}
            max={30}
            required
            value={tableCapacity}
            onChange={(event) => setTableCapacity(Number(event.target.value))}
          />
          <button
            className="secondary"
            type="button"
            onClick={async () => {
              if (!editingTableId) return;
              const result = await updateTableCapacity(editingTableId, tableCapacity);
              if (!result.ok) {
                showToast(result.error);
                return;
              }
              setTables((current) =>
                current.map((table) =>
                  table.id === result.data.id ? result.data : table,
                ),
              );
              showToast("Table capacity updated");
            }}
          >
            Save capacity
          </button>
          <label htmlFor="assignGuest">Add or move a guest</label>
          <div className="input-row">
            <select
              id="assignGuest"
              value={assignGuestId}
              onChange={(event) =>
                setAssignGuestId(
                  event.target.value ? Number(event.target.value) : "",
                )
              }
            >
              {guests.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} · party of {partySize(item)}
                  {item.table
                    ? ` (currently ${tables.find((table) => table.id === item.table)?.name ?? item.table})`
                    : ""}
                </option>
              ))}
            </select>
            <button
              className="primary"
              type="button"
              onClick={async () => {
                if (!editingTableId || assignGuestId === "") return;
                await handleAssign(assignGuestId, editingTableId);
              }}
            >
              Assign
            </button>
          </div>
          <div className="editor-guests">
            {assignedToEditor.length ? (
              assignedToEditor.map((item) => (
                <div className="editor-guest" key={item.id}>
                  <span>
                    <strong>{item.name}</strong>
                    <br />
                    <small>Party of {partySize(item)}</small>
                  </span>
                  <button
                    type="button"
                    className="remove-guest"
                    onClick={() => void handleAssign(item.id, null)}
                  >
                    Remove
                  </button>
                </div>
              ))
            ) : (
              <p className="guest-meta">No guests assigned yet.</p>
            )}
          </div>
          <button
            type="button"
            className="close-modal"
            onClick={() => tableDialog.current?.close()}
          >
            Close
          </button>
        </form>
      </dialog>

      <div id="toast" className={toastVisible ? "show" : ""} role="status">
        {toast}
      </div>
    </main>
  );
}
