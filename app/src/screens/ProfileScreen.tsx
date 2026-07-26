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
      <AvatarUpload value={avatarUrl} name={me.name} onChange={(next) => { setAvatarUrl(next); setSaved(false); }} />
      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}
      {dirty && (
        <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save photo"}
        </m.button>
      )}
      <h1 className="serif">{me.name}</h1>
      <dl className="profile__details">
        <dt>Email</dt><dd>{me.email}</dd>
        <dt>Phone</dt><dd className="mono">{me.phone}</dd>
      </dl>
      <m.button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }} whileTap={{ scale: 0.97 }}>
        Log out
      </m.button>
    </Screen>
  );
}
