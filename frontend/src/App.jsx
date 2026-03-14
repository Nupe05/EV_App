import { useEffect, useState } from "react";
import CustomerPanel from "./pages/CustomerPanel";
import DriverPanel from "./pages/DriverPanel";
import LoginBox from "./components/LoginBox";
import { useLocalStorage } from "./hooks/useLocalStorage";
import {
  customerApi,
  driverApi,
  setCustomerTokens,
  setDriverTokens,
} from "./api/clients";

export default function App() {
  const [mode, setMode] = useState("split");

  const [customerAccess, setCustomerAccess] = useLocalStorage("demo_customer_access", "");
  const [customerRefresh, setCustomerRefresh] = useLocalStorage("demo_customer_refresh", "");

  const [driverAccess, setDriverAccess] = useLocalStorage("demo_driver_access", "");
  const [driverRefresh, setDriverRefresh] = useLocalStorage("demo_driver_refresh", "");

  useEffect(() => {
    setCustomerTokens(customerAccess || "", customerRefresh || "");
  }, [customerAccess, customerRefresh]);

  useEffect(() => {
    setDriverTokens(driverAccess || "", driverRefresh || "");
  }, [driverAccess, driverRefresh]);

  function clearAll() {
    setCustomerAccess("");
    setCustomerRefresh("");
    setDriverAccess("");
    setDriverRefresh("");
  }

  return (
    <div style={{ padding: 18, fontFamily: "ui-sans-serif, system-ui", background: "#0b1220", minHeight: "100vh" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <div style={{ color: "white", fontSize: 22, fontWeight: 900 }}>
          EV Rescue Demo Console
        </div>

        <div style={{ color: "#cbd5e1", marginTop: 6 }}>
          Customer + Driver logged in simultaneously · Live timeline via WebSocket
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button style={tabBtn(mode === "customer")} onClick={() => setMode("customer")}>
            Customer
          </button>
          <button style={tabBtn(mode === "driver")} onClick={() => setMode("driver")}>
            Driver
          </button>
          <button style={tabBtn(mode === "split")} onClick={() => setMode("split")}>
            Split
          </button>

          <button style={{ ...tabBtn(false), marginLeft: "auto" }} onClick={clearAll}>
            Clear both logins
          </button>
        </div>

        <div style={{ marginTop: 12, background: "white", borderRadius: 18, padding: 14, display: "grid", gap: 10 }}>
          <LoginBox
            label="Customer"
            apiClient={customerApi}
            defaultUsername="customer1"
            defaultPassword="monique05"
            onTokens={(access, refresh) => {
              setCustomerAccess(access);
              setCustomerRefresh(refresh);
            }}
          />

          <LoginBox
            label="Driver"
            apiClient={driverApi}
            defaultUsername="driver1"
            defaultPassword="monique05"
            onTokens={(access, refresh) => {
              setDriverAccess(access);
              setDriverRefresh(refresh);
            }}
          />

          <div style={{ color: "#64748b", fontSize: 13 }}>
            Customer and Driver sessions auto-refresh in the background.
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            display: mode === "split" ? "grid" : "block",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          {(mode === "customer" || mode === "split") && (
            <CustomerPanel customerToken={customerAccess} />
          )}

          {(mode === "driver" || mode === "split") && (
            <DriverPanel driverToken={driverAccess} />
          )}
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