import { useState } from "react";
import { m } from "motion/react";
import { apiSend } from "../../lib/api";
import { clearToken, redirectToLogin } from "../../lib/session";
import type { PartnerProfile, VehicleType } from "../../lib/types";
import { usePartner } from "../../PartnerContext";
import { useMe, useSetMe } from "../../AuthGate";
import { Screen } from "../../components/Screen";
import { AvatarUpload } from "../../components/AvatarUpload";

const VEHICLES: { value: VehicleType; label: string }[] = [
  { value: "bike", label: "Bicycle" },
  { value: "motorcycle", label: "Motorcycle" },
  { value: "car", label: "Car" },
];

export function DProfileScreen() {
  const { profile, setProfile } = usePartner();
  const me = useMe();
  const setMe = useSetMe();
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [vehicleType, setVehicleType] = useState<VehicleType>(profile.vehicleType);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError(""); setSaved(false);
    if (!name.trim() || !phone.trim()) {
      setError("Name and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiSend<{ partner: PartnerProfile }>("PATCH", "/api/delivery/me", {
        name: name.trim(), phone: phone.trim(), vehicleType, avatarUrl,
      });
      setProfile(res.partner);
      setMe({ ...me, name: res.partner.name, avatarUrl: res.partner.avatarUrl });
      setSaved(true);
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    if (!window.confirm("Log out of FeastNow?")) return;
    clearToken();
    redirectToLogin();
  };

  return (
    <Screen className="profile">
      <h1 className="profile__heading">Rider Profile</h1>

      <div className="profile__hero">
        <AvatarUpload value={avatarUrl} name={name || me.name} onChange={(next) => { setAvatarUrl(next); setSaved(false); }} />
        <div className="profile__hero-info">
          <h2 className="profile__hero-name">{profile.name}</h2>
          <p className="profile__hero-mono mono">{profile.availabilityStatus === "online" ? "Online" : "Offline"}</p>
        </div>
      </div>

      <form className="profile__section" onSubmit={(e) => e.preventDefault()}>
        <h3 className="profile__section-title">Personal</h3>
        <div className="profile__card">
          <label className="profile__row">
            <span className="profile__row-label">Name</span>
            <input className="profile__row-input" type="text" value={name}
              onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="profile__row">
            <span className="profile__row-label">Phone</span>
            <input className="profile__row-input mono" type="tel" value={phone}
              onChange={(e) => setPhone(e.target.value)} />
          </label>
        </div>
      </form>

      <section className="profile__section">
        <h3 className="profile__section-title">Vehicle</h3>
        <div className="profile__card">
          <label className="profile__row">
            <span className="profile__row-label">Type</span>
            <select className="profile__row-select" value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as VehicleType)}>
              {VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
            </select>
          </label>
        </div>
      </section>

      <section className="profile__section">
        <h3 className="profile__section-title">Documents</h3>
        <div className="profile__card">
          <div className="profile__row">
            <span className="profile__row-label">ID document</span>
            <span className="dprofile__readonly">On file</span>
          </div>
        </div>
      </section>

      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}
      <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save changes"}
      </m.button>

      <div className="profile__actions">
        <button type="button" className="btn-danger rprofile__logout" onClick={logout}>Log out</button>
      </div>
    </Screen>
  );
}
