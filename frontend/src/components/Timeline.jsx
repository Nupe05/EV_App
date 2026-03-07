// frontend/src/components/Timeline.jsx

export default function Timeline({ job }) {
    if (!job) return null;
  
    const eta = job.eta_minutes != null ? `${job.eta_minutes} min` : "—";
    const initials = getInitials(job.technician_name || "Technician");
  
    return (
      <div style={wrap}>
        <div style={topRow}>
          <div style={{ flex: 1 }}>
            <div style={title}>{job.title || "In progress"}</div>
            <div style={subtitle}>{job.subtitle || "We’ll keep you updated."}</div>
            {job.next_hint ? <div style={hint}>Next: {job.next_hint}</div> : null}
          </div>
  
          <div style={etaBox}>
            <div style={etaLabel}>ETA</div>
            <div style={etaValue}>{eta}</div>
          </div>
        </div>
  
        {(job.technician_name || job.assigned_vehicle_label) && (
          <div style={techRow}>
            <div style={avatar}>{initials}</div>
  
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {job.technician_name ? (
                <div style={techName}>Technician: {job.technician_name}</div>
              ) : null}
  
              {job.assigned_vehicle_label ? (
                <div style={badge}>Vehicle {job.assigned_vehicle_label}</div>
              ) : null}
            </div>
          </div>
        )}
  
        <div style={metaRow}>
          <span>
            Pickup: <b>{job.pickup_address || "—"}</b>
          </span>
          <span>·</span>
          <span>
            SOC: <b>{job.customer_soc_percent ?? "—"}%</b>
          </span>
          <span>·</span>
          <span>
            Need: <b>{job.est_kwh_needed ?? "—"} kWh</b>
          </span>
        </div>
  
        <div style={steps}>
          {(job.timeline || []).map((s, idx) => {
            const state = s.is_active ? "active" : s.is_completed ? "done" : "todo";
  
            return (
              <div key={s.key} style={stepRow}>
                <div style={railWrap}>
                  <span style={dot(state)} />
                  {idx < job.timeline.length - 1 ? <span style={rail(state)} /> : null}
                </div>
  
                <div style={stepText(state)}>{s.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  
  function getInitials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("");
  }
  
  const wrap = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  };
  
  const topRow = {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "flex-start",
  };
  
  const title = {
    fontSize: 18,
    fontWeight: 900,
    color: "#0f172a",
  };
  
  const subtitle = {
    marginTop: 4,
    color: "#475569",
    fontSize: 14,
  };
  
  const hint = {
    marginTop: 8,
    color: "#64748b",
    fontSize: 13,
  };
  
  const etaBox = {
    minWidth: 88,
    textAlign: "right",
  };
  
  const etaLabel = {
    fontSize: 12,
    color: "#64748b",
    fontWeight: 800,
  };
  
  const etaValue = {
    fontSize: 22,
    fontWeight: 950,
    color: "#0f172a",
    marginTop: 2,
  };
  
  const techRow = {
    marginTop: 14,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 14,
    background: "#f8fafc",
    border: "1px solid #eef2f7",
  };
  
  const avatar = {
    width: 38,
    height: 38,
    borderRadius: 999,
    background: "linear-gradient(135deg, #0ea5e9, #2563eb)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 13,
    flex: "0 0 auto",
  };
  
  const techName = {
    fontWeight: 800,
    fontSize: 14,
    color: "#0f172a",
  };
  
  const badge = {
    alignSelf: "flex-start",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#e0f2fe",
    color: "#075985",
    fontWeight: 800,
    fontSize: 12,
  };
  
  const metaRow = {
    marginTop: 14,
    color: "#64748b",
    fontSize: 13,
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
  };
  
  const steps = {
    marginTop: 16,
    display: "grid",
    gap: 12,
  };
  
  const stepRow = {
    display: "grid",
    gridTemplateColumns: "18px 1fr",
    gap: 10,
    alignItems: "start",
  };
  
  const railWrap = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minHeight: 24,
  };
  
  function dot(state) {
    const base = {
      width: 11,
      height: 11,
      borderRadius: 999,
      display: "inline-block",
      flex: "0 0 auto",
      transition: "all 240ms ease",
    };
  
    if (state === "done") {
      return { ...base, background: "#22c55e" };
    }
  
    if (state === "active") {
      return {
        ...base,
        background: "#0ea5e9",
        boxShadow: "0 0 0 5px rgba(14,165,233,0.14)",
        transform: "scale(1.08)",
      };
    }
  
    return { ...base, background: "#cbd5e1" };
  }
  
  function rail(state) {
    return {
      width: 2,
      height: 24,
      marginTop: 4,
      borderRadius: 999,
      background: state === "done" ? "#86efac" : "#e2e8f0",
      transition: "background 240ms ease",
    };
  }
  
  function stepText(state) {
    const base = {
      fontSize: 15,
      transition: "all 220ms ease",
    };
  
    if (state === "done") {
      return { ...base, color: "#0f172a", fontWeight: 800 };
    }
  
    if (state === "active") {
      return { ...base, color: "#0f172a", fontWeight: 900 };
    }
  
    return { ...base, color: "#334155", fontWeight: 700 };
  }