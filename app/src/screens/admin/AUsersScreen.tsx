import { useCallback, useEffect, useState } from "react";
import { m } from "motion/react";
import { apiGet, apiSend } from "../../lib/api";
import { SearchBar } from "../../components/SearchBar";
import { Chip } from "../../components/Chip";
import { staggerParent, staggerChild } from "../../lib/motion";
import type { AdminUserRow, UserRole } from "../../lib/types";

const ROLES: { key: "" | UserRole; label: string }[] = [
  { key: "", label: "All" },
  { key: "customer", label: "Customers" },
  { key: "restaurant", label: "Restaurants" },
  { key: "delivery_partner", label: "Riders" },
];

export function AUsersScreen() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | UserRole>("");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (role) params.set("role", role);
    setUsers(await apiGet<{ users: AdminUserRow[] }>(`/api/admin/users?${params.toString()}`).then((r) => r.users));
  }, [q, role]);
  useEffect(() => { void load(); }, [load]);

  const toggle = async (u: AdminUserRow) => {
    const verb = u.suspended ? "reinstate" : "suspend";
    if (verb === "suspend" && !window.confirm(`Suspend ${u.name}? They will be unable to log in.`)) return;
    setBusyId(u.id);
    try { await apiSend("POST", `/api/admin/users/${u.id}/${verb}`); await load(); }
    catch { window.alert("Couldn't update this account."); }
    finally { setBusyId(null); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Users</h1>
      <SearchBar value={q} onChange={setQ} placeholder="Search name, email, or phone" />
      <div className="admin-chips">
        {ROLES.map((r) => <Chip key={r.key} label={r.label} selected={role === r.key} onClick={() => setRole(r.key)} />)}
      </div>
      <m.ul className="admin-list admin-list--wide" variants={staggerParent} initial="hidden" animate="show">
        {users.map((u) => (
          <m.li key={u.id} className="admin-card admin-userrow" variants={staggerChild}>
            <div>
              <span className="admin-row__title">{u.name}</span>
              <span className="admin-row__sub">{u.role} · {u.email} · joined {new Date(u.createdAt).toLocaleDateString()}</span>
            </div>
            <div className="admin-userrow__right">
              <span className={`admin-pill ${u.suspended ? "admin-pill--bad" : "admin-pill--ok"}`}>{u.suspended ? "Suspended" : "Active"}</span>
              {u.role !== "admin" && (
                <m.button whileTap={{ scale: 0.99 }} className={u.suspended ? "btn-primary" : "btn-danger"} disabled={busyId === u.id} onClick={() => void toggle(u)}>
                  {u.suspended ? "Reinstate" : "Suspend"}
                </m.button>
              )}
            </div>
          </m.li>
        ))}
      </m.ul>
      {users.length === 0 && <p className="admin-muted">No matching accounts.</p>}
    </div>
  );
}
