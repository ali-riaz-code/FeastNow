import { BrowserRouter } from "react-router-dom";
import { AuthGate, useMe } from "./AuthGate";
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
    <AuthGate>
      <BrowserRouter basename="/app">
        <RoleShell />
      </BrowserRouter>
    </AuthGate>
  );
}
