import { useEffect, useRef, useState } from "react";
import { m } from "motion/react";
import { apiGet, apiSend } from "../../lib/api";
import { clearToken } from "../../lib/session";
import { formatRating } from "../../lib/format";
import { compressImage, HERO_PRESET, ImageError } from "../../lib/image";
import type { OwnerProfile, OwnerReview } from "../../lib/types";
import { useOwner } from "../../OwnerContext";
import { Screen } from "../../components/Screen";
import { Reveal, RevealItem } from "../../components/Reveal";

export function RProfileScreen() {
  const { profile, setProfile } = useOwner();
  const [name, setName] = useState(profile.name);
  const [description, setDescription] = useState(profile.description);
  const [address, setAddress] = useState(profile.address);
  const [cuisines, setCuisines] = useState(profile.cuisines.join(", "));
  const [opensAt, setOpensAt] = useState(profile.opensAt);
  const [closesAt, setClosesAt] = useState(profile.closesAt);
  const [heroImageUrl, setHeroImageUrl] = useState(profile.heroImageUrl);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [reviews, setReviews] = useState<OwnerReview[]>([]);

  useEffect(() => {
    apiGet<{ reviews: OwnerReview[] }>("/api/restaurant/reviews")
      .then((res) => setReviews(res.reviews))
      .catch(() => setReviews([]));
  }, []);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    setPhotoError("");
    setPhotoBusy(true);
    try {
      setHeroImageUrl(await compressImage(file, HERO_PRESET));
    } catch (err) {
      setPhotoError(err instanceof ImageError ? err.message : "Couldn't process that image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const save = async () => {
    setError(""); setSaved(false);
    const cuisineList = cuisines.split(",").map((c) => c.trim()).filter(Boolean);
    if (!name.trim() || !address.trim() || cuisineList.length === 0) {
      setError("Name, address, and at least one cuisine are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await apiSend<{ profile: OwnerProfile }>("PATCH", "/api/restaurant/profile", {
        name: name.trim(), description: description.trim(), address: address.trim(),
        cuisines: cuisineList, opensAt, closesAt, heroImageUrl,
      });
      setProfile(res.profile);
      setHeroImageUrl(res.profile.heroImageUrl);
      setSaved(true);
    } catch {
      setError("Couldn't save. Check the hours format and try again.");
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    if (!window.confirm("Log out of FeastNow?")) return;
    clearToken();
    window.location.href = "/login.html";
  };

  const starCounts = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.stars === s).length }));
  const maxCount = Math.max(1, ...starCounts.map((c) => c.n));

  return (
    <Screen className="rform rprofile">
      <h1>Business info</h1>
      <div className="rform__field">
        <span>Restaurant photo</span>
        <p className="rphoto__hint">Shown to customers on your card and profile — a logo, storefront, or signature dish.</p>
        <div className="rphoto">
          <div className="rphoto__preview">
            {heroImageUrl
              ? <img src={heroImageUrl} alt="Current restaurant photo" />
              : <span className="rphoto__placeholder">No photo yet</span>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="rphoto__input" onChange={(e) => void pickPhoto(e)} />
          <button type="button" className="btn-retry rphoto__btn" disabled={photoBusy}
            onClick={() => fileRef.current?.click()}>
            {photoBusy ? "Processing…" : heroImageUrl ? "Change photo" : "Upload photo"}
          </button>
        </div>
        {photoError && <span className="cart__error" role="alert">{photoError}</span>}
      </div>
      <label className="rform__field"><span>Business name</span>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} /></label>
      <label className="rform__field"><span>Description</span>
        <textarea value={description} rows={2} onChange={(e) => setDescription(e.target.value)} /></label>
      <label className="rform__field"><span>Address</span>
        <input type="text" value={address} onChange={(e) => setAddress(e.target.value)} /></label>
      <label className="rform__field"><span>Cuisines (comma-separated)</span>
        <input type="text" value={cuisines} onChange={(e) => setCuisines(e.target.value)} /></label>
      <div className="rprofile__hours">
        <label className="rform__field"><span>Opens</span>
          <input type="time" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} /></label>
        <label className="rform__field"><span>Closes</span>
          <input type="time" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} /></label>
      </div>
      {error && <p className="cart__error" role="alert">{error}</p>}
      {saved && <p className="rprofile__saved" role="status">Saved.</p>}
      <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={saving} onClick={() => void save()}>
        {saving ? "Saving…" : "Save changes"}
      </m.button>

      <h1>Ratings &amp; reviews</h1>
      <p className="rprofile__avg">
        <span className="mono rprofile__avg-num">{formatRating(profile.avgRating)}</span> · {profile.ratingCount} ratings
      </p>
      <div className="rprofile__bars" aria-label="Ratings breakdown (recent reviews)">
        {starCounts.map(({ s, n }) => (
          <div key={s} className="rprofile__bar-row">
            <span className="mono">{s}★</span>
            <span className="rprofile__bar"><span style={{ width: `${(n / maxCount) * 100}%` }} /></span>
            <span className="mono">{n}</span>
          </div>
        ))}
      </div>
      <Reveal>
        {reviews.slice(0, 5).map((r) => (
          <RevealItem key={r.id}>
            <article className="rprofile__review">
              <p className="rprofile__review-head"><span className="mono">{r.stars}★</span> {r.authorName}</p>
              <p>{r.reviewText}</p>
            </article>
          </RevealItem>
        ))}
      </Reveal>
      {reviews.length === 0 && <p className="rsearch__hint">Reviews from customers will appear here.</p>}

      <button type="button" className="btn-danger rprofile__logout" onClick={logout}>Log out</button>
    </Screen>
  );
}
