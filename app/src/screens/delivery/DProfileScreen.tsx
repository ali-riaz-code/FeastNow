import { useState } from "react";
import { m } from "motion/react";
import { apiSend } from "../../lib/api";
import { clearToken, redirectToLogin } from "../../lib/session";
import type { PartnerProfile, VehicleType } from "../../lib/types";
import { usePartner } from "../../PartnerContext";
import { useMe, useSetMe } from "../../AuthGate";
import { Screen } from "../../components/Screen";
import { AppHeader } from "../../components/AppHeader";
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
    <Screen className="rform dprofile">
      <AppHeader title="Profile" />
      <h1>Rider profile</h1>
      <AvatarUpload value={avatarUrl} name={name || me.name} onChange={(next) => { setAvatarUrl(next); setSaved(false); }} />
      <label className="rform__field"><span>Full name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="rform__field"><span>Phone</span>
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
      <label className="rform__field"><span>Vehicle type</span>
        <select value={vehicleType} onChange={(e) => setVehicleType(e.target.value as VehicleType)}>
          {VEHICLES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
        </select></label>

      <label className="rform__field"><span>ID document</span>
        <p className="dprofile__readonly">On file · contact support to change.</p></label>

      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}
      <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save changes"}
      </m.button>

      <button type="button" className="btn-danger rprofile__logout" onClick={logout}>Log out</button>
    </Screen>
  );
}
