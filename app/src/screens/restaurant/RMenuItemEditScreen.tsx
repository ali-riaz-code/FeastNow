import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { m } from "motion/react";
import { apiGet, apiSend } from "../../lib/api";
import { compressImage, THUMB_PRESET, ImageError } from "../../lib/image";
import type { OwnerMenuItem } from "../../lib/types";
import { Screen } from "../../components/Screen";

export function RMenuItemEditScreen() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === undefined;
  const navigate = useNavigate();
  const [categories, setCategories] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [priceRs, setPriceRs] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [loaded, setLoaded] = useState(isNew);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<{ items: OwnerMenuItem[] }>("/api/restaurant/menu").then(({ items }) => {
      setCategories([...new Set(items.map((i) => i.category))]);
      if (!isNew) {
        const item = items.find((i) => i.id === id);
        if (!item) { setError("This item no longer exists."); return; }
        setName(item.name); setDescription(item.description); setCategory(item.category);
        setPriceRs(String(Math.round(item.priceCents / 100))); setIsAvailable(item.isAvailable);
        setImageUrl(item.imageUrl);
      }
      setLoaded(true);
    }).catch(() => setError("Couldn't load the menu. Go back and retry."));
  }, [id, isNew]);

  const save = async () => {
    setError("");
    const priceCents = Math.round(Number(priceRs) * 100);
    if (!name.trim() || !category.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      setError("Name, category, and a price above zero are required.");
      return;
    }
    setBusy(true);
    const body = { name: name.trim(), description: description.trim(), category: category.trim(), priceCents, isAvailable, imageUrl };
    try {
      if (isNew) await apiSend("POST", "/api/restaurant/menu-items", body);
      else await apiSend("PATCH", `/api/restaurant/menu-items/${id}`, body);
      navigate("/menu");
    } catch {
      setError("Couldn't save. Check the fields and try again.");
      setBusy(false);
    }
  };

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setPhotoBusy(true);
    try {
      setImageUrl(await compressImage(file, THUMB_PRESET));
    } catch (err) {
      setPhotoError(err instanceof ImageError ? err.message : "Couldn't process that image.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete “${name}” from your menu? Past orders keep their copy.`)) return;
    setBusy(true);
    try {
      await apiSend("DELETE", `/api/restaurant/menu-items/${id}`);
      navigate("/menu");
    } catch {
      setError("Couldn't delete this item.");
      setBusy(false);
    }
  };

  if (!loaded && !error) {
    return <Screen className="rqueue"><div className="restaurant__hero-skeleton" role="status" aria-label="Loading" /></Screen>;
  }

  return (
    <Screen className="rform">
      <h1>{isNew ? "Add item" : "Edit item"}</h1>
      <label className="rform__field">
        <span>Name</span>
        <input type="text" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="rform__field">
        <span>Description</span>
        <textarea value={description} maxLength={500} rows={2} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="rform__field">
        <span>Category</span>
        <input type="text" value={category} list="rcategories" placeholder="e.g. Pizze, Mains, Drinks"
          onChange={(e) => setCategory(e.target.value)} />
        <datalist id="rcategories">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>
      </label>
      <label className="rform__field">
        <span>Price (Rs)</span>
        <input type="number" inputMode="numeric" min="1" value={priceRs} onChange={(e) => setPriceRs(e.target.value)} />
      </label>
      <div className="rform__field">
        <span>Photo</span>
        <div className="rphoto">
          <div className="rphoto__preview rphoto__preview--thumb">
            {imageUrl
              ? <img src={imageUrl} alt="Current item photo" />
              : <span className="rphoto__placeholder">No photo</span>}
          </div>
          <div className="rphoto__actions">
            <input ref={fileRef} type="file" accept="image/*" className="rphoto__input" onChange={(e) => void pickPhoto(e)} />
            <button type="button" className="btn-retry rphoto__btn" disabled={photoBusy}
              onClick={() => fileRef.current?.click()}>
              {photoBusy ? "Processing…" : imageUrl ? "Change photo" : "Upload photo"}
            </button>
            {imageUrl && (
              <button type="button" className="rphoto__remove" disabled={photoBusy}
                onClick={() => setImageUrl(null)}>Remove</button>
            )}
          </div>
        </div>
        {photoError && <span className="cart__error" role="alert">{photoError}</span>}
      </div>
      <label className="rform__check">
        <input type="checkbox" checked={isAvailable} onChange={(e) => setIsAvailable(e.target.checked)} />
        <span>Available to order</span>
      </label>
      {error && <p className="cart__error" role="alert">{error}</p>}
      <div className="rform__actions">
        {!isNew && <button type="button" className="btn-danger" disabled={busy} onClick={() => void remove()}>Delete</button>}
        <m.button type="button" className="btn-primary" whileTap={{ scale: 0.97 }} disabled={busy} onClick={() => void save()}>{busy ? "Saving…" : "Save"}</m.button>
      </div>
      <button type="button" className="rsheet__cancel" onClick={() => navigate("/menu")}>Back to menu</button>
    </Screen>
  );
}
