import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, NetworkError } from "./lib/api";
import { getToken, redirectToLogin } from "./lib/session";
import type { Me } from "./lib/types";

const MeContext = createContext<Me | null>(null);

export function useMe(): Me {
  const me = useContext(MeContext);
  if (!me) throw new Error("useMe must be used inside AuthGate.");
  return me;
}

type AuthState =
  | { status: "loading" }
  | { status: "offline"; message: string }
  | { status: "ready"; me: Me };

export function AuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const boot = useCallback(async () => {
    setState({ status: "loading" });
    if (!getToken()) {
      redirectToLogin();
      return;
    }
    try {
      const me = await apiGet<Me>("/api/me");
      setState({ status: "ready", me });
    } catch (err) {
      if (err instanceof NetworkError) {
        // Valid session, no network — keep the token, offer retry.
        setState({ status: "offline", message: err.message });
      }
      // 401s already redirected inside apiGet.
    }
  }, []);

  useEffect(() => { void boot(); }, [boot]);

  if (state.status === "loading") {
    return <div className="boot-screen" role="status" aria-label="Loading">
      <span className="boot-screen__logo serif">FeastNow</span>
    </div>;
  }
  if (state.status === "offline") {
    return <div className="boot-screen">
      <p className="boot-screen__message">{state.message}</p>
      <button className="btn-retry" onClick={() => void boot()}>Try again</button>
    </div>;
  }
  return <MeContext.Provider value={state.me}>{children}</MeContext.Provider>;
}
