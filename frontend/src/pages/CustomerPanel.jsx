import { useEffect, useState } from "react";
import Timeline from "../components/Timeline";
import LiveMap from "../components/LiveMap";
import { useJobSocket } from "../hooks/useJobSocket";
import { customerApi } from "../api/clients";

export default function CustomerPanel({ customerToken }) {
  const [job, setJob] = useState(null);
  const { status: wsStatus, lastMessage } = useJobSocket(job?.id);

  useEffect(() => {
    if (lastMessage?.id) setJob(lastMessage);
  }, [lastMessage]);

  async function requestHelp() {
    if (!customerToken) return;

    const idem = crypto.randomUUID();

    const res = await customerApi.post(
      "/jobs/",
      {
        pickup_lat: 38.9072,
        pickup_lng: -77.0369,
        pickup_address: "Washington DC",
        customer_soc_percent: 12,
        est_kwh_needed: 15,
      },
      { headers: { "Idempotency-Key": idem } }
    );

    setJob(res.data);
  }

  async function refreshJob() {
    if (!job?.id) return;

    const res = await customerApi.get(`/jobs/${job.id}/`);
    setJob(res.data);
  }

  return (
    <div style={panel}>
      <h2 style={header}>Customer</h2>

      <div style={topBar}>
        <button
          style={primaryBtn}
          onClick={requestHelp}
          disabled={!customerToken}
        >
          Request Emergency Charge
        </button>

        {job && (
          <div style={jobMeta}>
            <span>WS: <b>{wsStatus}</b></span>

            <button style={ghostBtn} onClick={refreshJob}>
              Refresh
            </button>

            <span>
              Job: <b>{job.id.slice(0, 8)}…</b>
            </span>

            {job.distance_km != null && (
              <span>
                Driver distance: <b>{job.distance_km} km</b>
              </span>
            )}
          </div>
        )}
      </div>

      {!customerToken && (
        <div style={hint}>
          Log in as Customer to request assistance.
        </div>
      )}

      {job && (
        <div style={contentStack}>
          <Timeline job={job} />
          <LiveMap job={job} />
        </div>
      )}
    </div>
  );
}

const panel = {
  padding: 18,
  background: "#f8fafc",
  borderRadius: 20,
  border: "1px solid #e5e7eb",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

const header = {
  margin: 0,
  fontSize: 22,
  fontWeight: 900,
};

const topBar = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const jobMeta = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  alignItems: "center",
  fontSize: 14,
  color: "#475569",
};

const hint = {
  fontSize: 14,
  color: "#64748b",
};

const contentStack = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const primaryBtn = {
  padding: "12px 16px",
  borderRadius: 14,
  border: "none",
  background: "#0ea5e9",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
  alignSelf: "flex-start",
};

const ghostBtn = {
  padding: "6px 10px",
  borderRadius: 10,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
};