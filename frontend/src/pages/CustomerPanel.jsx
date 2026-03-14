import { useEffect, useState } from "react";
import Timeline from "../components/Timeline";
import LiveMap from "../components/LiveMap";
import { useJobSocket } from "../hooks/useJobSocket";
import { customerApi } from "../api/clients";

export default function CustomerPanel({ customerToken }) {
  const [job, setJob] = useState(null);
  const { status: wsStatus, lastMessage } = useJobSocket(job?.id);

  useEffect(() => {
    if (lastMessage?.id) {
      setJob(lastMessage);
    }
  }, [lastMessage]);

  // Polling fallback while job is active
  useEffect(() => {
    if (!job?.id) return;
    if (job.status === "COMPLETED" || job.status === "CANCELED") return;

    const interval = setInterval(async () => {
      try {
        const res = await customerApi.get(`/jobs/${job.id}/`);
        setJob(res.data);
      } catch (err) {
        console.log("customer refresh fallback failed", err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [job?.id, job?.status]);

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

  const isCompleted = job?.status === "COMPLETED";
  const isCanceled = job?.status === "CANCELED";
  const hasJob = !!job;

  return (
    <div style={panel}>
      <h2 style={header}>Customer</h2>

      <div style={topBar}>
        <button
          style={primaryBtn}
          onClick={requestHelp}
          disabled={!customerToken}
        >
          {isCompleted || isCanceled ? "Request Another Charge" : "Request Emergency Charge"}
        </button>

        {hasJob && (
          <div style={jobMeta}>
            <span>
              WS: <b>{wsStatus}</b>
            </span>

            {!isCompleted && !isCanceled ? (
              <button style={ghostBtn} onClick={refreshJob}>
                Refresh
              </button>
            ) : null}

            <span>
              Job: <b>{job.id.slice(0, 8)}…</b>
            </span>

            {job.distance_km != null ? (
              <span>
                Driver distance: <b>{job.distance_km} km</b>
              </span>
            ) : null}
          </div>
        )}
      </div>

      {!customerToken && (
        <div style={hint}>
          Log in as Customer to request assistance.
        </div>
      )}

      {isCompleted && (
        <div style={completedBanner}>
          <div style={completedTitle}>Service completed</div>
          <div style={completedText}>
            Your emergency charge was successfully delivered. You can request assistance again anytime.
          </div>
        </div>
      )}

      {isCanceled && (
        <div style={canceledBanner}>
          <div style={completedTitle}>Request canceled</div>
          <div style={completedText}>
            This request is no longer active. You can request assistance again whenever needed.
          </div>
        </div>
      )}

      {hasJob ? (
        <div style={contentStack}>
          <Timeline job={job} />
          <LiveMap job={job} />
        </div>
      ) : (
        customerToken && (
          <div style={emptyState}>
            <div style={emptyTitle}>Assistance is one tap away</div>
            <div style={emptyText}>
              Request a mobile charge and follow the technician live from assignment to completion.
            </div>
          </div>
        )
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

const emptyState = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 18,
};

const emptyTitle = {
  fontSize: 18,
  fontWeight: 900,
  color: "#0f172a",
};

const emptyText = {
  marginTop: 6,
  fontSize: 14,
  color: "#64748b",
  lineHeight: 1.5,
};

const completedBanner = {
  background: "#ecfdf5",
  border: "1px solid #bbf7d0",
  borderRadius: 16,
  padding: 14,
};

const canceledBanner = {
  background: "#fff7ed",
  border: "1px solid #fed7aa",
  borderRadius: 16,
  padding: 14,
};

const completedTitle = {
  fontSize: 16,
  fontWeight: 900,
  color: "#0f172a",
};

const completedText = {
  marginTop: 4,
  fontSize: 14,
  color: "#475569",
  lineHeight: 1.5,
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