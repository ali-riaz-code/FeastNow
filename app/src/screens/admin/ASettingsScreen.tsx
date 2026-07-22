import { useState } from "react";
import { m } from "motion/react";
import { useMe, useSetMe } from "../../AuthGate";
import { apiSend } from "../../lib/api";
import type { Me } from "../../lib/types";
import { AvatarUpload } from "../../components/AvatarUpload";

export function ASettingsScreen() {
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
      setError("Couldn't save your photo. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-screen">
      <h1 className="admin-screen__title">Settings</h1>
      <div className="admin-card admin-settings">
        <h2 className="admin-settings__heading">Profile photo</h2>
        <p className="admin-settings__hint">Shown next to your name in the admin console.</p>
        <AvatarUpload value={avatarUrl} name={me.name} onChange={(next) => { setAvatarUrl(next); setSaved(false); }} />
        <dl className="admin-settings__details">
          <dt>Name</dt><dd>{me.name}</dd>
          <dt>Email</dt><dd>{me.email}</dd>
        </dl>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {saved && <p className="rprofile__saved" role="status">Saved.</p>}
        {dirty && (
          <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save photo"}
          </m.button>
        )}
      </div>
    </div>
  );
}
