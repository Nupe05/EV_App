import { useEffect, useState } from "react";
import CustomerPanel from "./pages/CustomerPanel";
import DriverPanel from "./pages/DriverPanel";
import LoginBox from "./components/LoginBox";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { customerApi, driverApi, setCustomerToken, setDriverToken } from "./api/clients";

export default function App() {
  const [mode, setMode] = useState("split"); // customer|driver|split

  const [customerToken, setCustomerTokenLS] = useLocalStorage("demo_customer_access", "");
  const [driverToken, setDriverTokenLS] = useLocalStorage("demo_driver_access", "");

  // Apply tokens to their respective axios clients
  useEffect(() => setCustomerToken(customerToken || null), [customerToken]);
  useEffect(() => setDriverToken(driverToken || null), [driverToken]);

  return (
    <div style={{ padding: 18, fontFamily: "ui-sans-serif, system-ui", background: "#0b1220", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ color: "white", fontSize: 22, fontWeight: 900 }}>EV Rescue Demo Console</div>
        <div style={{ color: "#cbd5e1", marginTop: 6 }}>Customer + Driver logged in simultaneously · Live timeline via WebSocket</div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={tabBtn(mode === "customer")} onClick={() => setMode("customer")}>Customer</button>
          <button style={tabBtn(mode === "driver")} onClick={() => setMode("driver")}>Driver</button>
          <button style={tabBtn(mode === "split")} onClick={() => setMode("split")}>Split</button>

          <button
            style={{ ...tabBtn(false), marginLeft: "auto" }}
            onClick={() => { setCustomerTokenLS(""); setDriverTokenLS(""); }}
          >
            Clear both logins
          </button>
        </div>

        <div style={{ marginTop: 12, background: "white", borderRadius: 18, padding: 14, display: "grid", gap: 10 }}>
          <LoginBox
            label="Customer"
            apiClient={customerApi}
            defaultUsername="customer1"
            defaultPassword="monique05"
            onToken={(t) => setCustomerTokenLS(t)}
          />
          <LoginBox
            label="Driver"
            apiClient={driverApi}
            defaultUsername="driver1"
            defaultPassword="monique05"
            onToken={(t) => setDriverTokenLS(t)}
          />
          <div style={{ color: "#64748b", fontSize: 13 }}>
            Customer and Driver tokens are stored separately and applied to separate API clients.
          </div>
        </div>

        <div style={{ marginTop: 14, display: mode === "split" ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          {(mode === "customer" || mode === "split") && <CustomerPanel customerToken={customerToken} />}
          {(mode === "driver" || mode === "split") && <DriverPanel driverToken={driverToken} />}
        </div>
      </div>
    </div>
  );
}

function tabBtn(active) {
  return {
    padding: "10px 12px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.15)",
    background: active ? "rgba(14,165,233,0.25)" : "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: 800,
  };
}