import { useState } from "react";
import { m } from "motion/react";
import { useMe, useSetMe } from "../AuthGate";
import { apiSend } from "../lib/api";
import { clearToken, redirectToLogin } from "../lib/session";
import type { Me } from "../lib/types";
import { Screen } from "../components/Screen";
import { AvatarUpload } from "../components/AvatarUpload";

export function ProfileScreen() {
  const me = useMe();
  const setMe = useSetMe();
  const [avatarUrl, setAvatarUrl] = useState(me.avatarUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const dirty = avatarUrl !== me.avatarUrl;

  const save = async () => {
    setError(""); setSaved(false);
    setSaving(true);
    try {
      const updated = await apiSend<Me>("PATCH", "/api/me", { avatarUrl });
      setMe(updated);
      setAvatarUrl(updated.avatarUrl);
      setSaved(true);
    } catch {
      setError("Couldn't save your photo. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen className="profile">
      <h1 className="profile__heading">Profile</h1>

      <div className="profile__hero">
        <AvatarUpload value={avatarUrl} name={me.name} onChange={(next) => { setAvatarUrl(next); setSaved(false); }} />
        <div className="profile__hero-info">
          <h2 className="profile__hero-name">{me.name}</h2>
          <p className="profile__hero-meta">{me.role.replace("_", " ")}</p>
        </div>
      </div>

      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}

      {dirty && (
        <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save photo"}
        </m.button>
      )}

      <section className="profile__section">
        <h3 className="profile__section-title">Contact</h3>
        <div className="profile__card">
          <div className="profile__row">
            <span className="profile__row-label">Email</span>
            <span className="profile__row-value">{me.email}</span>
          </div>
          <div className="profile__row">
            <span className="profile__row-label">Phone</span>
            <span className="profile__row-value mono">{me.phone}</span>
          </div>
        </div>
      </section>

      <div className="profile__actions">
        <m.button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }} whileTap={{ scale: 0.97 }}>
          Log out
        </m.button>
      </div>
    </Screen>
  );
}
