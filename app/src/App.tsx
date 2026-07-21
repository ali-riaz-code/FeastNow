import { BrowserRouter } from "react-router-dom";
import { LazyMotion, MotionConfig } from "motion/react";
import { AuthGate, useMe } from "./AuthGate";
import { BootIntro } from "./components/BootIntro";
import { domMax } from "./lib/motion";
import { CustomerShell } from "./shells/CustomerShell";
import { RestaurantShell } from "./shells/RestaurantShell";
import { DeliveryShell } from "./shells/DeliveryShell";
import { AdminShell } from "./shells/AdminShell";

function RoleShell() {
  const me = useMe();
  // Anything unknown falls back to the customer experience (SRS §4.1).
  return me.role === "admin" ? <AdminShell />
    : me.role === "restaurant" ? <RestaurantShell />
    : me.role === "delivery_partner" ? <DeliveryShell />
    : <CustomerShell />;
}

export default function App() {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <BootIntro />
        <AuthGate>
          <BrowserRouter basename="/app">
            <RoleShell />
          </BrowserRouter>
        </AuthGate>
      </MotionConfig>
    </LazyMotion>
  );
}
