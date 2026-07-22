import { useRef, useState } from "react";
import { m } from "motion/react";
import { compressImage, AVATAR_PRESET, ImageError } from "../lib/image";

function initialsOf(name: string): string {
  return name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

interface AvatarUploadProps {
  /** Current staged photo (data URL or https URL), or null for the initials fallback. */
  value: string | null;
  /** Name used to render the initials monogram when there's no photo. */
  name: string;
  /** Called with the new data URL on pick, or null when the photo is removed. */
  onChange: (next: string | null) => void;
}

/**
 * Circular avatar preview with Upload / Change / Remove controls. Owns its own
 * compress + busy + error state; the parent owns the staged `value` and persists
 * it on Save. Shared by the customer, rider, and admin settings surfaces.
 */
export function AvatarUpload({ value, name, onChange }: AvatarUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      onChange(await compressImage(file, AVATAR_PRESET));
    } catch (err) {
      setError(err instanceof ImageError ? err.message : "Couldn't process that image.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="avatar-upload">
      <div className="avatar-upload__preview">
        {value
          ? <img src={value} alt="Your profile photo" />
          : <span className="avatar-upload__initials serif" aria-hidden="true">{initialsOf(name)}</span>}
      </div>
      <div className="avatar-upload__controls">
        <input ref={fileRef} type="file" accept="image/*" className="avatar-upload__input"
          onChange={(e) => void pick(e)} />
        <m.button type="button" className="btn-retry avatar-upload__btn" whileTap={{ scale: 0.97 }}
          disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? "Processing…" : value ? "Change photo" : "Upload photo"}
        </m.button>
        {value && (
          <button type="button" className="avatar-upload__remove" disabled={busy}
            onClick={() => { setError(""); onChange(null); }}>
            Remove
          </button>
        )}
      </div>
      {error && <span className="cart__error" role="alert">{error}</span>}
    </div>
  );
}
