# Profile photo uploads for customer, rider, and admin

**Date:** 2026-07-22
**Status:** Design — awaiting user review

## 1. Problem

Restaurants can upload a photo (stored inline as a compressed JPEG data URL on
`RestaurantProfile.heroImageUrl`), and menu items have `imageUrl`. But the three
`User`-backed roles — **customer, delivery partner (rider), and admin** — have no
profile picture. Their profile surfaces show only an initials monogram. We want
each of them to be able to set, change, and remove a profile photo (pfp) from a
settings surface.

## 2. Approach

Reuse the restaurant photo pattern exactly — no new infrastructure:

- Client compresses the picked image to a small square JPEG **data URL**
  (`compressImage` in `app/src/lib/image.ts`).
- The data URL is stored **inline** in a new nullable DB column; validated by the
  existing `isValidImageRef` (≤ 3 MB, `data:image/(png|jpeg|jpg|webp);base64,…`).
- No object storage, no new external service.

Because customer, rider, and admin all authenticate as `User` and share the
`GET /api/me` DTO, a **single `avatarUrl` column on `User`** covers all three.

### UX decisions (confirmed with user)

- **Staged with a Save button** — picking a photo shows a local preview; it only
  persists when the user presses that screen's Save button. (Matches the
  restaurant flow.)
- **New admin Settings screen** — admins get a dedicated `/settings` route + a
  sidebar nav item, rather than an inline sidebar control.
- **Remove is supported** — the user can clear the photo and fall back to
  initials. The PATCH accepts `avatarUrl: null`.

## 3. Data model

Add one column to `User` in `backend/prisma/schema.prisma`:

```prisma
model User {
  ...
  avatarUrl    String?   // inline compressed JPEG data URL; null = show initials
  ...
}
```

One Prisma migration. No backfill needed (null is the valid "no photo" state).

## 4. Backend

### 4.1 Shared `GET /api/me` DTO (`meRouter.ts`)
Add `avatarUrl: user.avatarUrl ?? null` to the response object. This is the DTO
that populates `Me` for **all** roles, so the field is available everywhere.

### 4.2 New `PATCH /api/me` (`meRouter.ts`) — customer & admin
- Auth: existing `requireAuth`.
- Body: `{ avatarUrl?: string | null }`.
- Validation:
  - `avatarUrl === null` → clears the photo (allowed).
  - `avatarUrl` a string → must pass `isValidImageRef`, else `400`
    (`"Invalid image — upload a photo under 3 MB."`).
  - `avatarUrl === undefined` → no-op on that field.
- Returns the same shape as `GET /api/me` (the updated `Me`).
- Requires a `UserRepository.updateAvatar(userId, avatarUrl)` (or a small
  `updateProfile`) method — add to `backend/src/repositories/userRepository.ts`
  and the fake in `backend/tests/test-helpers/`.

### 4.3 Rider — fold into existing `PATCH /api/delivery/me`
The rider profile screen already saves `name`, `phone`, `vehicleType` through
`PATCH /api/delivery/me` (which writes `User.name`/`User.phone`). Extend that
endpoint to also accept optional `avatarUrl` (same `isValidImageRef` / nullable
rules) and persist it on the `User` row, so the rider keeps a **single** Save
request. Add `avatarUrl` to the `PartnerProfile` DTO returned by delivery
endpoints.

> Rationale: customer and admin have no role-specific profile endpoint, so
> `/api/me` is their natural home; the rider already has one, so avoid a second
> round-trip. Validation is shared via `isValidImageRef`, so the only duplication
> is one validation guard.

## 5. Client

### 5.1 `AVATAR_PRESET` (`app/src/lib/image.ts`)
Add a small square preset: `{ maxDim: 400, quality: 0.8 }`. (Avatars render small;
400px keeps the inline data URL well under the 3 MB ceiling.)

### 5.2 `Me` type + writable `MeContext`
- Add `avatarUrl: string | null` to the `Me` interface (`app/src/lib/types.ts`).
- Make `MeContext` writable so a successful save updates the avatar app-wide
  (e.g. header monograms). `AuthGate` exposes a `setMe` (or `patchMe`) alongside
  the value; `useMe()` stays the read hook, add a `useSetMe()` (or return a
  tuple) — keep the change minimal and backward-compatible with existing
  `useMe()` call sites.

### 5.3 Reusable `AvatarUpload` component (`app/src/components/AvatarUpload.tsx`)
One focused, presentational-plus-staging component so the three screens don't
duplicate pick/preview/compress logic.

- **Props:** `value: string | null` (current staged data URL), `name: string`
  (for the initials fallback), `onChange(next: string | null)`, and an optional
  `busy`/`error` display — or it owns its own compress/busy/error state and just
  emits `onChange`. Prefer: component owns compress + busy + error, parent owns
  the staged `value` and the Save call.
- **Renders:** circular preview (photo if `value`, else initials monogram),
  an **Upload / Change photo** button (hidden file input, `accept="image/*"`),
  and a **Remove** button shown only when `value` is set (calls `onChange(null)`).
- **On pick:** `compressImage(file, AVATAR_PRESET)` → `onChange(dataUrl)`; on
  `ImageError` show the message inline (reuses `.cart__error` styling pattern).
- Motion/`whileTap` on buttons to match the shell's interaction feel.

### 5.4 Wire into the three surfaces

**Customer — `ProfileScreen.tsx`** (currently read-only, no form):
- Stage `avatarUrl` from `me.avatarUrl` in local state.
- Render `<AvatarUpload>` in place of the static initials block.
- Add a **Save** button (the screen's first) that calls `PATCH /api/me` with the
  staged `avatarUrl`, updates `MeContext`, and shows a `Saved.` status. Show it as
  dirty/enabled only when the staged value differs from `me.avatarUrl`.

**Rider — `DProfileScreen.tsx`** (has a Save form):
- Stage `avatarUrl` from `profile.avatarUrl`.
- Render `<AvatarUpload>` above the name field.
- The existing Save handler additionally sends `avatarUrl` in the
  `PATCH /api/delivery/me` body; on success update both `PartnerContext` and
  `MeContext`.

**Admin — new `ASettingsScreen.tsx` + route:**
- New screen at `app/src/screens/admin/ASettingsScreen.tsx`: shows the admin's
  name/email (read-only), an `<AvatarUpload>`, and a **Save** button →
  `PATCH /api/me`, updating `MeContext`.
- Add `{ to: "/settings", label: "Settings", end: false }` to the `NAV` array and
  a `<Route path="/settings" element={<ASettingsScreen />} />` in `AdminShell.tsx`.
- Replace the sidebar-foot initials/email area to render the avatar (or keep email
  + show avatar) — small visual tie-in so the uploaded photo is visible in the
  chrome.

### 5.5 Where avatars display beyond settings
Update the initials monograms to prefer the photo when present:
- Customer `ProfileScreen` avatar block (now the `AvatarUpload` preview).
- Any `AppHeader`/shell monogram that currently derives initials from `me.name`
  (audit `profile__avatar` / initials usages found in the shells and headers).
Keep initials as the fallback everywhere `avatarUrl` is null.

## 6. Validation & limits

- Reuse `isValidImageRef` / `MAX_IMAGE_REF_LEN` (3 MB) on the backend — no new
  limit constants.
- Client compression (400px, q0.8) keeps payloads tiny; the ImageError messages
  already cover unreadable / non-image files.

## 7. Testing

- **Backend:** unit-test `PATCH /api/me` (valid data URL saved; `null` clears;
  oversized/garbage → 400; unauthenticated → 401) and the extended
  `/api/delivery/me` avatar handling. Update fake repositories to carry
  `avatarUrl`.
- **Client:** the app has light test coverage; at minimum type-check + build must
  pass. Manually verify pick → preview → Save → reload shows the photo, and
  Remove → Save → reload shows initials, for all three roles.

## 8. Out of scope

- Editing name/email/phone from these settings screens (photo only for now).
- Restaurant owner avatar (they already have `heroImageUrl`; the *account*
  monogram is not part of this request).
- Cropping / zoom UI — the square compress is the whole transform.
- Object storage / CDN — inline data URLs, consistent with the existing pattern.

## 9. Files touched (summary)

- `backend/prisma/schema.prisma` — add `User.avatarUrl` (+ migration).
- `backend/src/repositories/userRepository.ts` — `updateAvatar`.
- `backend/src/routes/meRouter.ts` — DTO field + `PATCH /`.
- `backend/src/routes/deliveryRouter.ts` — accept `avatarUrl`; DTO field.
- `backend/tests/**` — fakes + new route tests.
- `app/src/lib/types.ts` — `Me.avatarUrl`, `PartnerProfile.avatarUrl`.
- `app/src/lib/image.ts` — `AVATAR_PRESET`.
- `app/src/AuthGate.tsx` — writable `MeContext` / setter.
- `app/src/components/AvatarUpload.tsx` — new shared component.
- `app/src/screens/ProfileScreen.tsx` — avatar + Save.
- `app/src/screens/delivery/DProfileScreen.tsx` — avatar in existing form.
- `app/src/screens/admin/ASettingsScreen.tsx` — new screen.
- `app/src/shells/AdminShell.tsx` — nav item + route + sidebar avatar.
- `app/src/styles/*.css` — avatar-upload styling (reuse `rphoto`-style patterns).
