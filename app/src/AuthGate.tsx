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
      // 401s already redirected (full page nav) inside apiGet; whatever we
      // set here is moot. Every other failure — NetworkError, ApiError from
      // a 5xx, or anything unexpected — gets the same offline/retry state.
      // The token is left in place (no forced logout on a server blip).
      const message = err instanceof NetworkError
        ? err.message
        : "Something went wrong. Check your connection and try again.";
      setState({ status: "offline", message });
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
