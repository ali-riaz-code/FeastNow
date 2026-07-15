import { useMe } from "../AuthGate";
import { clearToken, redirectToLogin } from "../lib/session";

export function ProfileScreen() {
  const me = useMe();
  const initials = me.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <main className="screen profile">
      <div className="profile__avatar serif" aria-hidden="true">{initials}</div>
      <h1 className="serif">{me.name}</h1>
      <dl className="profile__details">
        <dt>Email</dt><dd>{me.email}</dd>
        <dt>Phone</dt><dd className="mono">{me.phone}</dd>
      </dl>
      <button className="btn-logout" onClick={() => { clearToken(); redirectToLogin(); }}>
        Log out
      </button>
    </main>
  );
}
