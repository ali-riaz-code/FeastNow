import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiGet, NetworkError } from "./lib/api";
import type { PartnerProfile } from "./lib/types";
import { DPendingApprovalScreen } from "./screens/delivery/DPendingApprovalScreen";

interface PartnerContextValue {
  profile: PartnerProfile;
  setProfile: (p: PartnerProfile) => void;
  refresh: () => Promise<void>;
}

const PartnerContext = createContext<PartnerContextValue | null>(null);

export function usePartner(): PartnerContextValue {
  const ctx = useContext(PartnerContext);
  if (!ctx) throw new Error("usePartner must be used inside PartnerProvider.");
  return ctx;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; profile: PartnerProfile };

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const refresh = useCallback(async () => {
    const { partner } = await apiGet<{ partner: PartnerProfile }>("/api/delivery/me");
    setState({ status: "ready", profile: partner });
  }, []);

  useEffect(() => {
    refresh().catch((err: unknown) => {
      setState({
        status: "error",
        message: err instanceof NetworkError ? err.message : "Couldn't load your rider account. Try again.",
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
      <button className="btn-retry" onClick={() => { setState({ status: "loading" }); void refresh().catch(() => setState({ status: "error", message: "Couldn't load your rider account. Try again." })); }}>Try again</button>
    </div>;
  }
  // Approval gate is wired but dormant this phase (partners auto-approve on signup).
  if (!state.profile.approved) {
    return <DPendingApprovalScreen refresh={refresh} />;
  }
  return (
    <PartnerContext.Provider value={{ profile: state.profile, refresh, setProfile: (p) => setState({ status: "ready", profile: p }) }}>
      {children}
    </PartnerContext.Provider>
  );
}
