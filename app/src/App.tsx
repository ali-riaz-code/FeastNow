import { BrowserRouter } from "react-router-dom";
import { AuthGate, useMe } from "./AuthGate";
import { CustomerShell } from "./shells/CustomerShell";
import { RestaurantShell } from "./shells/RestaurantShell";

function RoleShell() {
  const me = useMe();
  // Delivery partner and admin shells arrive in later phases; anything
  // unknown falls back to the customer experience (SRS §4.1).
  return me.role === "restaurant" ? <RestaurantShell /> : <CustomerShell />;
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
