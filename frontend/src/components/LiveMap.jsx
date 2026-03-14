import {
    MapContainer,
    TileLayer,
    Marker,
    Polyline,
    CircleMarker,
    useMap,
  } from "react-leaflet";
  import { useEffect, useMemo, useRef, useState } from "react";
  import L from "leaflet";
  
  function makeSvgIcon({ bg, border = "#ffffff", label = "" }) {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="18" fill="${bg}" stroke="${border}" stroke-width="3" />
        <text x="21" y="26" text-anchor="middle" font-size="18" font-family="Arial, sans-serif" fill="white">${label}</text>
      </svg>
    `;
  
    return L.icon({
      iconUrl: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
      iconSize: [42, 42],
      iconAnchor: [21, 21],
    });
  }
  
  const PickupIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });
  
  const DriverIcon = makeSvgIcon({
    bg: "#16a34a",
    label: "🚚",
  });
  
  function FitBoundsOnce({ points }) {
    const map = useMap();
    const hasFitRef = useRef(false);
  
    useEffect(() => {
      if (hasFitRef.current) return;
  
      const valid = (points || []).filter(
        (p) =>
          Array.isArray(p) &&
          p.length === 2 &&
          Number.isFinite(p[0]) &&
          Number.isFinite(p[1])
      );
  
      if (!valid.length) return;
  
      const bounds = L.latLngBounds(
        valid.map(([lat, lng]) => L.latLng(lat, lng))
      ).pad(0.2);
  
      map.fitBounds(bounds, { animate: true });
      hasFitRef.current = true;
    }, [map, points]);
  
    return null;
  }
  
  function AnimatedDriverMarker({ target }) {
    const [pos, setPos] = useState(
      Array.isArray(target) && target.length === 2 ? target : null
    );
    const rafRef = useRef(null);
  
    useEffect(() => {
      if (!Array.isArray(target) || target.length !== 2) return;
  
      const next = [Number(target[0]), Number(target[1])];
  
      if (!pos) {
        setPos(next);
        return;
      }
  
      const start = [...pos];
      const end = [...next];
      const duration = 700;
      const startTime = performance.now();
  
      const tick = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const lat = start[0] + (end[0] - start[0]) * t;
        const lng = start[1] + (end[1] - start[1]) * t;
        setPos([lat, lng]);
  
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };
  
      rafRef.current = requestAnimationFrame(tick);
  
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }, [target]);
  
    if (!pos) return null;
  
    return (
      <>
        <Marker position={pos} icon={DriverIcon} zIndexOffset={1000} />
        <CircleMarker
          center={pos}
          radius={14}
          pathOptions={{
            color: "#16a34a",
            fillColor: "#16a34a",
            fillOpacity: 0.12,
            weight: 2,
          }}
        />
      </>
    );
  }
  
  export default function LiveMap({
    job,
    routeGeometry = [],
    driverOverride = null,
  }) {
    const pickup = useMemo(() => {
      if (job?.pickup_lat == null || job?.pickup_lng == null) return null;
      return [Number(job.pickup_lat), Number(job.pickup_lng)];
    }, [job?.pickup_lat, job?.pickup_lng]);
  
    const liveDriver = useMemo(() => {
      if (
        Array.isArray(driverOverride) &&
        driverOverride.length === 2 &&
        Number.isFinite(driverOverride[0]) &&
        Number.isFinite(driverOverride[1])
      ) {
        return [Number(driverOverride[0]), Number(driverOverride[1])];
      }
  
      if (
        job?.driver_lat !== null &&
        job?.driver_lat !== undefined &&
        job?.driver_lng !== null &&
        job?.driver_lng !== undefined
      ) {
        return [Number(job.driver_lat), Number(job.driver_lng)];
      }
  
      return null;
    }, [driverOverride, job?.driver_lat, job?.driver_lng]);
  
    const center = liveDriver || pickup || [38.9072, -77.0369];
  
    const boundsPoints = [
      ...(routeGeometry || []),
      pickup,
      liveDriver,
    ].filter(Boolean);
  
    return (
      <div style={wrap}>
        <div style={header}>
          <div style={{ fontWeight: 950, fontSize: 14 }}>Live Map</div>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {job?.distance_km != null
              ? `Driver distance: ${job.distance_km} km`
              : liveDriver
              ? "Driver en route"
              : "Waiting for driver location…"}
          </div>
        </div>
  
        <div style={mapClip}>
          <MapContainer
            center={center}
            zoom={13}
            scrollWheelZoom={false}
            style={mapStyle}
          >
            <TileLayer
              attribution="&copy; OpenStreetMap contributors"
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
  
            <FitBoundsOnce points={boundsPoints} />
  
            {pickup ? (
              <>
                <Marker position={pickup} icon={PickupIcon} zIndexOffset={10} />
                <CircleMarker
                  center={pickup}
                  radius={10}
                  pathOptions={{
                    color: "#0ea5e9",
                    fillColor: "#0ea5e9",
                    fillOpacity: 0.2,
                    weight: 2,
                  }}
                />
              </>
            ) : null}
  
            {liveDriver ? <AnimatedDriverMarker target={liveDriver} /> : null}
  
            {routeGeometry?.length ? (
              <Polyline
                positions={routeGeometry}
                pathOptions={{
                  color: "#334155",
                  weight: 4,
                  opacity: 0.8,
                }}
              />
            ) : pickup && liveDriver ? (
              <Polyline
                positions={[liveDriver, pickup]}
                pathOptions={{
                  color: "#334155",
                  weight: 4,
                  opacity: 0.75,
                }}
              />
            ) : null}
          </MapContainer>
        </div>
      </div>
    );
  }
  
  const wrap = {
    background: "white",
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 12,
    boxShadow: "0 1px 2px rgba(15,23,42,0.04)",
  };
  
  const header = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: 12,
    marginBottom: 10,
  };
  
  const mapClip = {
    borderRadius: 16,
    overflow: "hidden",
    border: "1px solid #eef2f7",
  };
  
  const mapStyle = {
    height: 320,
    width: "100%",
  };