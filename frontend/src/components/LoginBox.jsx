import { useState } from "react";
import { login } from "../api/auth";

export default function LoginBox({
  label,
  apiClient,
  defaultUsername,
  defaultPassword,
  onTokens,
}) {
  const [username, setUsername] = useState(defaultUsername);
  const [password, setPassword] = useState(defaultPassword);
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");

    try {
      const data = await login(apiClient, username, password);
      onTokens?.(data.access, data.refresh);
    } catch {
      setErr("Login failed");
    }
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <b>{label} login:</b>

      <input
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="username"
        style={inp}
      />

      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        type="password"
        style={inp}
      />

      <button style={btn} type="submit">
        Login
      </button>

      {err ? <span style={{ color: "crimson" }}>{err}</span> : null}
    </form>
  );
}

const inp = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
};

const btn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  fontWeight: 700,
};