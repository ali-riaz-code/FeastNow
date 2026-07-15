import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AuthGate } from "./AuthGate";
import { TabBar } from "./components/TabBar";
import { HomeScreen } from "./screens/HomeScreen";
import { OrdersScreen } from "./screens/OrdersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { RestaurantScreen } from "./screens/RestaurantScreen";

// Placeholder replaced in Task 17.
const SearchScreen = () => <main className="screen">Search</main>;

export default function App() {
  return (
    <AuthGate>
      <BrowserRouter basename="/app">
        <div className="shell">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/restaurant/:id" element={<RestaurantScreen />} />
            <Route path="/search" element={<SearchScreen />} />
            <Route path="/orders" element={<OrdersScreen />} />
            <Route path="/profile" element={<ProfileScreen />} />
          </Routes>
          <TabBar />
        </div>
      </BrowserRouter>
    </AuthGate>
  );
}
