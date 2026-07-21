import { useCallback, useEffect, useState } from "react";
import { apiGet, apiSend } from "../../lib/api";
import type { AdminApprovalRow, AdminRestaurantDetail, AdminRiderRow } from "../../lib/types";

export function AApprovalsScreen() {
  const [tab, setTab] = useState<"restaurants" | "riders">("restaurants");
  const [rows, setRows] = useState<AdminApprovalRow[]>([]);
  const [selected, setSelected] = useState<AdminRestaurantDetail | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [latInput, setLatInput] = useState("");
  const [lngInput, setLngInput] = useState("");

  const load = useCallback(async () => {
    setRows(await apiGet<{ approvals: AdminApprovalRow[] }>("/api/admin/approvals").then((r) => r.approvals));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    setNote("");
    setLatInput("");
    setLngInput("");
    setSelected(await apiGet<{ restaurant: AdminRestaurantDetail }>(`/api/admin/approvals/${id}`).then((r) => r.restaurant));
  };

  const setLocation = async () => {
    if (!selected) return;
    const lat = Number(latInput);
    const lng = Number(lngInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
    setBusy(true);
    try {
      const { restaurant } = await apiSend<{ restaurant: AdminRestaurantDetail }>(
        "PATCH", `/api/admin/approvals/${selected.id}/location`, { lat, lng });
      setSelected(restaurant);
      setLatInput("");
      setLngInput("");
    } catch { window.alert("Couldn't update this restaurant. Check your connection."); }
    finally { setBusy(false); }
  };

  const decide = async (verb: "approve" | "reject") => {
    if (!selected) return;
    setBusy(true);
    try {
      await apiSend("POST", `/api/admin/approvals/${selected.id}/${verb}`, { note: note.trim() || undefined });
      setSelected(null);
      await load();
    } catch { window.alert("Couldn't update this restaurant. Check your connection."); }
    finally { setBusy(false); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Approvals</h1>
      <div className="admin-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "restaurants"}
          className={`admin-tab${tab === "restaurants" ? " admin-tab--active" : ""}`}
          onClick={() => setTab("restaurants")}
        >
          Restaurants
        </button>
        <button
          role="tab"
          aria-selected={tab === "riders"}
          className={`admin-tab${tab === "riders" ? " admin-tab--active" : ""}`}
          onClick={() => setTab("riders")}
        >
          Riders
        </button>
      </div>
      {tab === "restaurants" ? (
        <>
          {rows.length === 0 && <p className="admin-muted">No restaurants awaiting review.</p>}
          <div className="admin-split">
            <ul className="admin-list">
              {rows.map((r) => (
                <li key={r.id}>
                  <button className={`admin-row${selected?.id === r.id ? " admin-row--active" : ""}`} onClick={() => void open(r.id)}>
                    <span className="admin-row__title">{r.name}</span>
                    <span className="admin-row__sub">{r.cuisines.join(", ")} · {r.address}</span>
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <div className="admin-card admin-detail">
                <h2 className="admin-detail__name serif">{selected.name}</h2>
                <p className="admin-detail__line">{selected.address}</p>
                <p className="admin-detail__line">{selected.cuisines.join(", ")}</p>
                <p className="admin-detail__line">Hours: {selected.opensAt}–{selected.closesAt}</p>
                <p className="admin-detail__desc">{selected.description || "No description provided."}</p>
                {/* Location */}
                <div className="admin-detail__loc">
                  {selected.lat == null || selected.lng == null ? (
                    <p className="admin-warn" role="alert">
                      No location set — deliveries can&rsquo;t be auto-assigned until you set coordinates.
                    </p>
                  ) : (
                    <p className="admin-muted">Location: {selected.lat.toFixed(5)}, {selected.lng.toFixed(5)}</p>
                  )}
                  <form onSubmit={(e) => { e.preventDefault(); void setLocation(); }}>
                    <input inputMode="decimal" placeholder="lat" value={latInput} onChange={(e) => setLatInput(e.target.value)} />
                    <input inputMode="decimal" placeholder="lng" value={lngInput} onChange={(e) => setLngInput(e.target.value)} />
                    <button type="submit" className="btn-secondary" disabled={busy}>Set location</button>
                  </form>
                </div>
                <label className="admin-field">
                  <span>Reason (optional)</span>
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for approve/reject" />
                </label>
                <div className="admin-actions">
                  <button className="btn-primary" disabled={busy} onClick={() => void decide("approve")}>Approve</button>
                  <button className="btn-danger" disabled={busy} onClick={() => void decide("reject")}>Reject</button>
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        <RidersPanel />
      )}
    </div>
  );
}

function RidersPanel() {
  const [riders, setRiders] = useState<AdminRiderRow[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRiders(await apiGet<{ riders: AdminRiderRow[] }>("/api/admin/rider-approvals").then((r) => r.riders));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const approve = async (id: string) => {
    setApprovingId(id);
    try {
      await apiSend("POST", `/api/admin/rider-approvals/${id}/approve`, {});
      await load();
    } catch { window.alert("Couldn't update this rider. Check your connection."); }
    finally { setApprovingId(null); }
  };

  return (
    <div className="admin-screen">
      {riders.length === 0 && <p className="admin-muted">No riders awaiting approval.</p>}
      <ul className="admin-list">
        {riders.map((r) => (
          <li key={r.id} className="admin-row">
            <div>
              <div className="admin-row__title">{r.name} · {r.vehicleType}</div>
              <div className="admin-muted">{r.email} · {r.phone}</div>
            </div>
            <button className="btn-primary" disabled={approvingId === r.id} onClick={() => void approve(r.id)}>
              {approvingId === r.id ? "Approving…" : "Approve"}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
