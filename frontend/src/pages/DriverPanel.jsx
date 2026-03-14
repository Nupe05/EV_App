import { useEffect, useMemo, useRef, useState } from "react";
import { driverApi } from "../api/clients";
import LiveMap from "../components/LiveMap";

function formatDistanceKm(km) {
  if (km == null || Number.isNaN(km)) return "—";
  return `${km.toFixed(1)} km`;
}

function formatDurationMin(mins) {
  if (mins == null || Number.isNaN(mins)) return "—";
  return `${Math.max(1, Math.round(mins))} min`;
}

function buildInstruction(step) {
  const maneuver = step?.maneuver || {};
  const type = maneuver.type || "continue";
  const modifier = maneuver.modifier || "";
  const roadName = step?.name ? ` onto ${step.name}` : "";

  if (type === "depart") return `Depart${roadName}`;
  if (type === "arrive") return "Arrive at destination";
  if (type === "turn") return `Turn ${modifier || "ahead"}${roadName}`;
  if (type === "continue") return `Continue${roadName}`;
  if (type === "new name") return `Continue${roadName}`;
  if (type === "merge") return `Merge ${modifier || ""}${roadName}`.trim();
  if (type === "on ramp") return `Take the ramp${roadName}`;
  if (type === "off ramp") return `Take the exit${roadName}`;
  if (type === "fork") return `Keep ${modifier || "ahead"}${roadName}`;
  if (type === "roundabout") return `Enter roundabout${roadName}`;
  if (type === "roundabout turn") return `At roundabout, take the exit${roadName}`;
  if (type === "end of road") return `At end of road, turn ${modifier || "ahead"}${roadName}`;

  return `Continue${roadName}`;
}

async function fetchOsrmRoute(startLat, startLng, endLat, endLng) {
  const coords = `${startLng},${startLat};${endLng},${endLat}`;
  const url =
    `https://router.project-osrm.org/route/v1/driving/${coords}` +
    `?steps=true&geometries=geojson&overview=full`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`OSRM route request failed: ${res.status}`);
  }

  const data = await res.json();
  if (data.code !== "Ok" || !data.routes?.length) {
    throw new Error(data.message || "No route found");
  }

  const route = data.routes[0];
  const leg = route.legs?.[0];

  const routeGeometry =
    route.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];

  let cursor = 0;
  const steps =
    leg?.steps?.map((step, idx) => {
      const geometry =
        step.geometry?.coordinates?.map(([lng, lat]) => [lat, lng]) || [];

      const pointCount = Math.max(geometry.length, 1);
      const startPointIndex = cursor;
      const endPointIndex = cursor + pointCount - 1;
      cursor = endPointIndex + 1;

      return {
        id: `${idx}-${step.name || "step"}`,
        instruction: buildInstruction(step),
        distanceMeters: step.distance,
        durationSeconds: step.duration,
        name: step.name,
        maneuver: step.maneuver,
        geometry,
        startPointIndex,
        endPointIndex,
      };
    }) || [];

  return {
    routeGeometry,
    steps,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}

export default function DriverPanel({ driverToken }) {
  const [offers, setOffers] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [routeData, setRouteData] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [currentPointIndex, setCurrentPointIndex] = useState(0);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showTurns, setShowTurns] = useState(true);

  const simRef = useRef(null);

  useEffect(() => {
    if (!driverToken) return;

    loadOffers();
    const t = setInterval(loadOffers, 2500);
    return () => clearInterval(t);
  }, [driverToken]);

  async function loadOffers() {
    const res = await driverApi.get("/driver/offers/");
    setOffers(res.data);
  }

  async function loadActiveJob(jobId) {
    const res = await driverApi.get(`/jobs/${jobId}/`);
    setActiveJob(res.data);
    return res.data;
  }

  function getStepIndexForPoint(pointIdx, steps) {
    if (!steps?.length) return 0;

    const idx = steps.findIndex(
      (step) => pointIdx >= step.startPointIndex && pointIdx <= step.endPointIndex
    );

    return idx >= 0 ? idx : Math.max(0, steps.length - 1);
  }

  async function buildRouteForJob(job) {
    if (!job?.pickup_lat || !job?.pickup_lng) return;

    setLoadingRoute(true);
    try {
      const startLat =
        job.driver_lat != null ? Number(job.driver_lat) : Number(job.pickup_lat) + 0.03;
      const startLng =
        job.driver_lng != null ? Number(job.driver_lng) : Number(job.pickup_lng) - 0.03;

      const route = await fetchOsrmRoute(
        startLat,
        startLng,
        Number(job.pickup_lat),
        Number(job.pickup_lng)
      );

      setRouteData(route);
      setCurrentPointIndex(0);
      setCurrentStepIndex(0);
      setShowTurns(true);
    } catch (err) {
      console.error(err);
      setRouteData(null);
    } finally {
      setLoadingRoute(false);
    }
  }

  async function acceptOffer(offerId, jobId) {
    await driverApi.post(`/offers/${offerId}/accept/`);
    const job = await loadActiveJob(jobId);
    await buildRouteForJob(job);
    await loadOffers();
  }

  async function updateStatus(status) {
    if (!activeJob) return;

    await driverApi.post(`/jobs/${activeJob.id}/status/`, { status });
    const job = await loadActiveJob(activeJob.id);
    setActiveJob(job);

    if (status === "ARRIVED") {
      setCurrentStepIndex(Math.max(0, (routeData?.steps?.length || 1) - 1));
    }
    if (status === "COMPLETED") {
      setSimRunning(false);
      setShowTurns(false);
    }
  }

  async function startRouteSim() {
    if (!activeJob || !routeData?.routeGeometry?.length || simRunning) return;

    setSimRunning(true);
    setShowTurns(true);

    await driverApi.post(`/jobs/${activeJob.id}/status/`, { status: "EN_ROUTE" });

    const points = routeData.routeGeometry;

    const [firstLat, firstLng] = points[0];
    const firstRes = await driverApi.post(`/jobs/${activeJob.id}/location/`, {
      lat: firstLat,
      lng: firstLng,
    });
    setActiveJob(firstRes.data);
    setCurrentPointIndex(0);
    setCurrentStepIndex(getStepIndexForPoint(0, routeData.steps));

    let idx = 1;

    simRef.current = setInterval(async () => {
      try {
        if (idx >= points.length) {
          stopRouteSim();

          await driverApi.post(`/jobs/${activeJob.id}/status/`, { status: "ARRIVED" });
          const arrivedJob = await loadActiveJob(activeJob.id);
          setActiveJob(arrivedJob);
          setCurrentStepIndex(Math.max(0, (routeData?.steps?.length || 1) - 1));

          setTimeout(async () => {
            await driverApi.post(`/jobs/${activeJob.id}/status/`, { status: "CHARGING" });
            const chargingJob = await loadActiveJob(activeJob.id);
            setActiveJob(chargingJob);

            setTimeout(async () => {
              await driverApi.post(`/jobs/${activeJob.id}/status/`, { status: "COMPLETED" });
              const completedJob = await loadActiveJob(activeJob.id);
              setActiveJob(completedJob);
              setSimRunning(false);
              setShowTurns(false);
            }, 3500);
          }, 1800);

          return;
        }

        const [lat, lng] = points[idx];
        const res = await driverApi.post(`/jobs/${activeJob.id}/location/`, { lat, lng });
        setActiveJob(res.data);

        setCurrentPointIndex(idx);
        setCurrentStepIndex(getStepIndexForPoint(idx, routeData.steps));

        idx += 1;
      } catch (err) {
        console.error("route sim error", err);
        stopRouteSim();
        setSimRunning(false);
      }
    }, 1200);
  }

  function stopRouteSim() {
    if (simRef.current) {
      clearInterval(simRef.current);
      simRef.current = null;
    }
    setSimRunning(false);
  }

  function resetCockpit() {
    stopRouteSim();
    setActiveJob(null);
    setRouteData(null);
    setCurrentPointIndex(0);
    setCurrentStepIndex(0);
    setShowTurns(true);
    loadOffers();
  }

  function openGoogleMaps() {
    if (!activeJob?.pickup_lat || !activeJob?.pickup_lng) return;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${activeJob.pickup_lat},${activeJob.pickup_lng}&travelmode=driving`;
    window.open(url, "_blank");
  }

  function openAppleMaps() {
    if (!activeJob?.pickup_lat || !activeJob?.pickup_lng) return;
    const url = `http://maps.apple.com/?daddr=${activeJob.pickup_lat},${activeJob.pickup_lng}`;
    window.open(url, "_blank");
  }

  const activeStep = useMemo(() => {
    if (!routeData?.steps?.length) return null;
    return routeData.steps[currentStepIndex] || routeData.steps[0] || null;
  }, [routeData, currentStepIndex]);

  const isAssignedState = activeJob?.status === "ASSIGNED";
  const isEnRouteState = activeJob?.status === "EN_ROUTE";
  const isArrivedState = activeJob?.status === "ARRIVED";
  const isChargingState = activeJob?.status === "CHARGING";
  const isCompletedState = activeJob?.status === "COMPLETED";

  const stateCard = useMemo(() => {
    if (loadingRoute) {
      return {
        label: "Navigation",
        text: "Building route…",
        bg: "#0ea5e9",
      };
    }

    if (isCompletedState) {
      return {
        label: "Job status",
        text: "Charge complete",
        bg: "#22c55e",
      };
    }

    if (isChargingState) {
      return {
        label: "Job status",
        text: "Charging in progress",
        bg: "#0ea5e9",
      };
    }

    if (isArrivedState) {
      return {
        label: "Job status",
        text: "Arrived at destination",
        bg: "#0ea5e9",
      };
    }

    if (isEnRouteState) {
      return {
        label: "Next turn",
        text: activeStep?.instruction || "Continue to customer",
        bg: "#0ea5e9",
      };
    }

    return {
      label: "Navigation",
      text: activeStep?.instruction || "Route ready",
      bg: "#0ea5e9",
    };
  }, [loadingRoute, isCompletedState, isChargingState, isArrivedState, isEnRouteState, activeStep]);

  const primaryAction = useMemo(() => {
    if (isCompletedState) {
      return {
        label: "Reset cockpit",
        onClick: resetCockpit,
        disabled: false,
        style: completeBtn,
      };
    }

    if (isChargingState) {
      return {
        label: "Mark complete",
        onClick: () => updateStatus("COMPLETED"),
        disabled: false,
        style: completeBtn,
      };
    }

    if (isArrivedState) {
      return {
        label: "Start charging",
        onClick: () => updateStatus("CHARGING"),
        disabled: false,
        style: primaryBtn,
      };
    }

    if (simRunning) {
      return {
        label: "Driving…",
        onClick: () => {},
        disabled: true,
        style: primaryBtn,
      };
    }

    if (isAssignedState || isEnRouteState) {
      return {
        label: "Start route",
        onClick: startRouteSim,
        disabled: !routeData,
        style: primaryBtn,
      };
    }

    return {
      label: "Start route",
      onClick: startRouteSim,
      disabled: !routeData,
      style: primaryBtn,
    };
  }, [isCompletedState, isChargingState, isArrivedState, isAssignedState, isEnRouteState, simRunning, routeData]);

  return (
    <div style={panel}>
      <h2 style={header}>Driver Cockpit</h2>

      {!driverToken ? (
        <div style={empty}>Log in as Driver to view offers.</div>
      ) : !activeJob ? (
        <>
          <div style={sectionTitle}>Available Offers</div>

          {offers.length === 0 ? (
            <div style={empty}>Waiting for dispatch…</div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {offers.map((o) => (
                <div key={o.id} style={offerCard}>
                  <div>
                    <div style={offerTitle}>Job {o.job.slice(0, 8)}…</div>
                    <div style={offerMeta}>Vehicle: {o.vehicle_label}</div>
                  </div>

                  <button style={acceptBtn} onClick={() => acceptOffer(o.id, o.job)}>
                    Accept
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <>
          <div style={heroCard}>
            <div>
              <div style={heroTitle}>Navigate to Customer</div>
              <div style={heroSubtitle}>{activeJob.pickup_address}</div>

              <div style={heroMeta}>
                {activeJob.technician_name ? (
                  <span style={chipBlue}>Tech {activeJob.technician_name}</span>
                ) : null}
                {activeJob.assigned_vehicle_label ? (
                  <span style={chipBlue}>Vehicle {activeJob.assigned_vehicle_label}</span>
                ) : null}
                <span style={chipGray}>
                  ETA {formatDurationMin(activeJob.eta_minutes)}
                </span>
                <span style={chipGray}>
                  Distance {formatDistanceKm(activeJob.distance_km)}
                </span>
              </div>
            </div>

            <div style={statusPill(activeJob.status)}>{activeJob.status}</div>
          </div>

          <LiveMap
          job={activeJob}driverOverride={routeData?.routeGeometry?.[currentPointIndex] || null}
          routeGeometry={(routeData?.routeGeometry || []).slice(currentPointIndex)}/>

          <div style={{ ...nextTurnCard, background: stateCard.bg }}>
            <div style={nextTurnLabel}>{stateCard.label}</div>
            <div style={nextTurnTextStyle}>{stateCard.text}</div>
          </div>

          <div style={assignmentStrip}>
            <span style={assignmentChip}>Job {activeJob.id.slice(0, 8)}…</span>
            {activeJob.assigned_vehicle_label ? (
              <span style={assignmentChip}>Unit {activeJob.assigned_vehicle_label}</span>
            ) : null}
            <span style={assignmentChip}>Point {currentPointIndex}</span>
          </div>

          <div style={controlsWrap}>
            <button
              style={primaryAction.style}
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
            >
              {primaryAction.label}
            </button>

            <button style={ghostBtn} onClick={stopRouteSim} disabled={!simRunning}>
              Stop
            </button>

            <button
              style={ghostBtn}
              onClick={() => updateStatus("ARRIVED")}
              disabled={isCompletedState || isArrivedState || isChargingState}
            >
              Arrived
            </button>

            <button
              style={ghostBtn}
              onClick={() => updateStatus("CHARGING")}
              disabled={isCompletedState || isChargingState}
            >
              Charging
            </button>

            <button
              style={completeBtn}
              onClick={() => updateStatus("COMPLETED")}
              disabled={isCompletedState}
            >
              Complete
            </button>
          </div>

          <div style={externalWrap}>
            <button style={ghostBtn} onClick={openGoogleMaps}>
              Open in Google Maps
            </button>
            <button style={ghostBtn} onClick={openAppleMaps}>
              Open in Apple Maps
            </button>
            <button style={ghostBtn} onClick={() => setShowTurns((v) => !v)}>
              {showTurns ? "Hide turns" : "Show turns"}
            </button>
          </div>

          {showTurns && !isCompletedState ? (
            <div style={stepsCard}>
              <div style={stepsTitle}>Turn-by-turn</div>

              <div style={{ display: "grid", gap: 10 }}>
                {(routeData?.steps || []).map((step, idx) => {
                  const isDone = idx < currentStepIndex;
                  const isActive = idx === currentStepIndex && !isCompletedState;
                  const isFuture = idx > currentStepIndex;

                  return (
                    <div
                      key={step.id}
                      style={{
                        ...stepRow,
                        ...(isActive ? activeStepRow : {}),
                        ...(isDone ? doneStepRow : {}),
                      }}
                    >
                      <div
                        style={{
                          ...stepIndex,
                          ...(isActive ? activeStepIndex : {}),
                          ...(isDone ? doneStepIndex : {}),
                        }}
                      >
                        {idx + 1}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            ...stepInstruction,
                            ...(isFuture ? futureStepInstruction : {}),
                          }}
                        >
                          {step.instruction}
                        </div>

                        <div style={stepMeta}>
                          {(step.distanceMeters / 1000).toFixed(2)} km ·{" "}
                          {Math.max(1, Math.round(step.durationSeconds / 60))} min
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </>
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

const sectionTitle = {
  fontWeight: 900,
  fontSize: 16,
};

const empty = {
  color: "#64748b",
};

const offerCard = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: 14,
  borderRadius: 16,
  border: "1px solid #e5e7eb",
  background: "white",
};

const offerTitle = {
  fontWeight: 900,
  color: "#0f172a",
};

const offerMeta = {
  fontSize: 13,
  color: "#64748b",
  marginTop: 4,
};

const acceptBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#16a34a",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const heroCard = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid #e5e7eb",
  background: "white",
  display: "flex",
  justifyContent: "space-between",
  gap: 14,
  alignItems: "flex-start",
};

const heroTitle = {
  fontWeight: 950,
  fontSize: 17,
  color: "#0f172a",
};

const heroSubtitle = {
  color: "#64748b",
  marginTop: 4,
};

const heroMeta = {
  marginTop: 10,
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const chipBlue = {
  padding: "5px 10px",
  borderRadius: 999,
  background: "#e0f2fe",
  color: "#075985",
  fontWeight: 800,
  fontSize: 12,
};

const chipGray = {
  padding: "5px 10px",
  borderRadius: 999,
  background: "#f1f5f9",
  color: "#334155",
  fontWeight: 800,
  fontSize: 12,
};

const assignmentStrip = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const assignmentChip = {
  padding: "5px 10px",
  borderRadius: 999,
  background: "#f8fafc",
  border: "1px solid #e5e7eb",
  color: "#334155",
  fontWeight: 800,
  fontSize: 12,
};

function statusPill(status) {
  return {
    padding: "6px 10px",
    borderRadius: 999,
    background: "#dbeafe",
    color: "#1d4ed8",
    fontWeight: 900,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}

const nextTurnCard = {
  padding: 14,
  borderRadius: 16,
  color: "white",
};

const nextTurnLabel = {
  fontSize: 12,
  opacity: 0.85,
  fontWeight: 800,
};

const nextTurnTextStyle = {
  fontSize: 20,
  fontWeight: 950,
  marginTop: 4,
  lineHeight: 1.2,
};

const controlsWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const externalWrap = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const primaryBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#0f172a",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const ghostBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  background: "white",
  cursor: "pointer",
  fontWeight: 800,
};

const completeBtn = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "none",
  background: "#22c55e",
  color: "white",
  cursor: "pointer",
  fontWeight: 900,
};

const stepsCard = {
  background: "white",
  border: "1px solid #e5e7eb",
  borderRadius: 18,
  padding: 14,
};

const stepsTitle = {
  fontWeight: 900,
  marginBottom: 12,
  color: "#0f172a",
};

const stepRow = {
  display: "flex",
  gap: 12,
  alignItems: "flex-start",
  padding: "8px 8px",
  borderRadius: 12,
  transition: "all 180ms ease",
};

const activeStepRow = {
  background: "#eff6ff",
};

const doneStepRow = {
  opacity: 0.72,
};

const stepIndex = {
  width: 28,
  height: 28,
  borderRadius: 999,
  background: "#e2e8f0",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  flex: "0 0 auto",
};

const activeStepIndex = {
  background: "#0ea5e9",
  color: "white",
};

const doneStepIndex = {
  background: "#bbf7d0",
  color: "#166534",
};

const stepInstruction = {
  fontWeight: 800,
  color: "#0f172a",
};

const futureStepInstruction = {
  color: "#334155",
};

const stepMeta = {
  fontSize: 12,
  color: "#64748b",
  marginTop: 4,
};