import { useCallback, useEffect, useState } from "react";
import { m } from "motion/react";
import { apiGet, apiSend, ApiError } from "../../lib/api";
import { staggerParent, staggerChild } from "../../lib/motion";
import type { AdminPromo, DiscountType } from "../../lib/types";

export function APromotionsScreen() {
  const [promos, setPromos] = useState<AdminPromo[]>([]);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [value, setValue] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPromos(await apiGet<{ promos: AdminPromo[] }>("/api/admin/promos").then((r) => r.promos));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setError(null); setBusy(true);
    try {
      await apiSend("POST", "/api/admin/promos", {
        code, discountType, discountValue: Number(value),
        expiresAt: expiry ? new Date(expiry).toISOString() : undefined,
      });
      setCode(""); setValue(""); setExpiry("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError && e.status === 409 ? "That code already exists." : "Couldn't create the code. Check the values.");
    } finally { setBusy(false); }
  };

  const deactivate = async (p: AdminPromo) => {
    if (!window.confirm(`Deactivate ${p.code}?`)) return;
    try { await apiSend("POST", `/api/admin/promos/${p.id}/deactivate`); await load(); }
    catch { window.alert("Couldn't deactivate this code."); }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Promotions</h1>
      <div className="admin-card admin-promoform">
        <div className="admin-field"><span>Code</span><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10" /></div>
        <div className="admin-field"><span>Type</span>
          <select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)}>
            <option value="percentage">Percentage (%)</option>
            <option value="fixed">Fixed (Rs, in cents)</option>
          </select>
        </div>
        <div className="admin-field"><span>Value</span><input inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} placeholder={discountType === "percentage" ? "1–100" : "cents"} /></div>
        <div className="admin-field"><span>Expiry (optional)</span><input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} /></div>
        <m.button whileTap={{ scale: 0.99 }} className="btn-primary" disabled={busy} onClick={() => void create()}>Create Promo Code</m.button>
        {error && <p className="admin-error">{error}</p>}
      </div>
      <m.ul className="admin-list admin-list--wide" variants={staggerParent} initial="hidden" animate="show">
        {promos.map((p) => (
          <m.li key={p.id} className="admin-card admin-promorow" variants={staggerChild}>
            <div>
              <span className="admin-promorow__code mono">{p.code}</span>
              <span className="admin-row__sub">
                {p.discountType === "percentage" ? `${p.discountValue}% off` : `Rs ${(p.discountValue / 100).toFixed(0)} off`}
                {p.expiresAt ? ` · expires ${new Date(p.expiresAt).toLocaleDateString()}` : ""}
              </span>
            </div>
            <div className="admin-userrow__right">
              <span className={`admin-pill ${p.active ? "admin-pill--ok" : "admin-pill--warn"}`}>{p.active ? "Active" : "Inactive"}</span>
              {p.active && <m.button whileTap={{ scale: 0.99 }} className="btn-danger" onClick={() => void deactivate(p)}>Deactivate</m.button>}
            </div>
          </m.li>
        ))}
      </m.ul>
      {promos.length === 0 && <p className="admin-muted">No promo codes yet.</p>}
    </div>
  );
}
