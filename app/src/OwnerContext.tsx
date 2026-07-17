import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, NetworkError } from "./lib/api";
import type { OwnerProfile } from "./lib/types";
import { PendingApprovalScreen } from "./screens/restaurant/PendingApprovalScreen";

interface OwnerContextValue {
  profile: OwnerProfile;
  setProfile: (p: OwnerProfile) => void;
  refresh: () => Promise<void>;
}

const OwnerContext = createContext<OwnerContextValue | null>(null);

export function useOwner(): OwnerContextValue {
  const ctx = useContext(OwnerContext);
  if (!ctx) throw new Error("useOwner must be used inside OwnerProvider.");
  return ctx;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: OwnerProfile };

export function OwnerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });
  // Show the celebration once when approval flips while the user is watching.
  const [celebrated, setCelebrated] = useState(false);

  const refresh = useCallback(async () => {
    const { profile } = await apiGet<{ profile: OwnerProfile }>("/api/restaurant/me");
    setState((prev) => {
      // Boot straight into an approved account → skip the celebration screen.
      // A pending→approved flip while watching → celebration until onContinue.
      if (prev.status !== "ready" && profile.approvalStatus === "approved") setCelebrated(true);
      return { status: "ready", profile };
    });
  }, []);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setState({
        status: "error",
        message: err instanceof NetworkError ? err.message : "Couldn't load your restaurant. Try again.",
      });
    });
  }, [refresh]);

  if (state.status === "loading") {
    return <div className="boot-screen" role="status" aria-label="Loading">
      <span className="boot-screen__logo serif">FeastNow</span>
    </div>;
  }
  if (state.status === "error") {
    return <div className="boot-screen">
      <p className="boot-screen__message">{state.message}</p>
      <button className="btn-retry" onClick={() => { setState({ status: "loading" }); void refresh().catch(() => setState({ status: "error", message: "Couldn't load your restaurant. Try again." })); }}>Try again</button>
    </div>;
  }
  if (state.profile.approvalStatus !== "approved" || !celebrated) {
    // Covers pending (poll + wait), rejected (dead end), and the one-time
    // "you're live" moment right after an approval flip.
    return (
      <PendingApprovalScreen
        profile={state.profile}
        refresh={refresh}
        onContinue={() => setCelebrated(true)}
      />
    );
  }
  return (
    <OwnerContext.Provider value={{ profile: state.profile, refresh, setProfile: (p) => setState({ status: "ready", profile: p }) }}>
      {children}
    </OwnerContext.Provider>
  );
}
