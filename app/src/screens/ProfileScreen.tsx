import { m } from "motion/react";
import { useMe } from "../AuthGate";
import { clearToken, redirectToLogin } from "../lib/session";
import { popIn } from "../lib/motion";
import { Screen } from "../components/Screen";
import { AppHeader } from "../components/AppHeader";

export function ProfileScreen() {
  const me = useMe();
  const initials = me.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <Screen className="profile">
      <AppHeader title="Profile" />
      <m.div className="profile__avatar serif" aria-hidden="true" variants={popIn} initial="hidden" animate="show">
        {initials}
      </m.div>
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
