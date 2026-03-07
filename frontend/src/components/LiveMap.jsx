import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap } from "react-leaflet";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";

const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const TruckIcon = L.divIcon({
  html: `
    <div style="
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: #16a34a;
      color: white;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:18px;
      box-shadow: 0 6px 16px rgba(22,163,74,0.28);
      border: 2px solid white;
    ">🚚</div>
  `,
  className: "",
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

L.Marker.prototype.options.icon = DefaultIcon;

function FitBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    const valid = (points || []).filter(
      (p) => Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])
    );
    if (!valid.length) return;

    const bounds = L.latLngBounds(valid.map(([lat, lng]) => L.latLng(lat, lng))).pad(0.25);
    map.fitBounds(bounds, { animate: true });
  }, [map, points]);

  return null;
}

function AnimatedDriverMarker({ target }) {
  const [pos, setPos] = useState(target || null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!target) return;

    if (!pos) {
      setPos(target);
      return;
    }

    const start = [...pos];
    const end = [...target];
    const duration = 900;
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
      <Marker position={pos} icon={TruckIcon} />
      <CircleMarker
        center={pos}
        radius={12}
        pathOptions={{ color: "#16a34a", fillColor: "#16a34a", fillOpacity: 0.16 }}
      />
    </>
  );
}

export default function LiveMap({ job, routeGeometry = [] }) {
  const pickup = useMemo(() => {
    if (job?.pickup_lat == null || job?.pickup_lng == null) return null;
    return [Number(job.pickup_lat), Number(job.pickup_lng)];
  }, [job?.pickup_lat, job?.pickup_lng]);

  const driver = useMemo(() => {
    if (job?.driver_lat == null || job?.driver_lng == null) return null;
    return [Number(job.driver_lat), Number(job.driver_lng)];
  }, [job?.driver_lat, job?.driver_lng]);

  const center = pickup || driver || [38.9072, -77.0369];
  const boundsPoints = [...(routeGeometry || []), pickup, driver].filter(Boolean);

  return (
    <div style={wrap}>
      <div style={header}>
        <div style={{ fontWeight: 950, fontSize: 14 }}>Live Map</div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {job?.distance_km != null ? `Driver distance: ${job.distance_km} km` : "Waiting for driver location…"}
        </div>
      </div>

      <div style={mapClip}>
        <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={mapStyle}>
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={boundsPoints} />

          {pickup ? (
            <>
              <Marker position={pickup} icon={DefaultIcon} />
              <CircleMarker
                center={pickup}
                radius={10}
                pathOptions={{ color: "#0ea5e9", fillColor: "#0ea5e9", fillOpacity: 0.2 }}
              />
            </>
          ) : null}

          {driver ? <AnimatedDriverMarker target={driver} /> : null}

          {routeGeometry?.length ? (
            <Polyline positions={routeGeometry} pathOptions={{ color: "#334155", weight: 4, opacity: 0.8 }} />
          ) : pickup && driver ? (
            <Polyline positions={[driver, pickup]} pathOptions={{ color: "#334155", weight: 4, opacity: 0.75 }} />
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