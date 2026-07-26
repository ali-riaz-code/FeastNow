import { useState } from "react";
import { m } from "motion/react";
import { useMe, useSetMe } from "../AuthGate";
import { apiSend } from "../lib/api";
import { clearToken, redirectToLogin } from "../lib/session";
import type { Me } from "../lib/types";
import { Screen } from "../components/Screen";
import { AvatarUpload } from "../components/AvatarUpload";
import { easeExpo } from "../lib/motion";

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
      <m.div className="profile__hero profile__hero--navy"
        initial={{ opacity: 0, y: -14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: easeExpo }}>
        <AvatarUpload value={avatarUrl} name={me.name} onChange={(next) => { setAvatarUrl(next); setSaved(false); }} />
        <div className="profile__hero-info">
          <h2 className="profile__hero-name script">{me.name}</h2>
          <span className="profile__role-badge">
            <svg viewBox="0 0 64 64" width="14" height="14" fill="none" stroke="currentColor"
              strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" aria-hidden="true">
              <path d="M18 38 Q7 38 8 28 Q3 21 12 18 Q12 10 21 12 Q24 6 32 8 Q40 6 43 12 Q52 10 52 18 Q61 21 56 28 Q57 38 46 38 Z" />
              <path d="M18 38 L46 38 L46 47 Q46 50 43 50 L21 50 Q18 50 18 47 Z" />
              <path d="M24.5 40 L24.5 48 M39.5 40 L39.5 48" strokeWidth="2" />
            </svg>
            {me.role.replace("_", " ")}
          </span>
        </div>
        <span className="profile__hero-seal" aria-hidden="true">★</span>
      </m.div>

      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}

      {dirty && (
        <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save photo"}
        </m.button>
      )}

      <m.section className="profile__section"
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: easeExpo, delay: 0.08 }}>
        <div className="profile__seam" aria-hidden="true" />
        <h3 className="profile__section-title profile__section-title--gold">Contact</h3>
        <div className="profile__card">
          <div className="profile__row">
            <span className="profile__row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-10 7L2 7" />
              </svg>
            </span>
            <span className="profile__row-label">Email</span>
            <span className="profile__row-value">{me.email}</span>
          </div>
          <div className="profile__row">
            <span className="profile__row-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </span>
            <span className="profile__row-label">Phone</span>
            <span className="profile__row-value mono">{me.phone}</span>
          </div>
        </div>
      </m.section>

      <m.p className="profile__signature script"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ duration: 0.5, ease: easeExpo, delay: 0.15 }}>grazie</m.p>

      <div className="profile__actions">
        <m.button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }} whileTap={{ scale: 0.97 }}>
          Log out
        </m.button>
      </div>
    </Screen>
  );
}
