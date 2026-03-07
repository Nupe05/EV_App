# dispatch/presenter.py

from __future__ import annotations

from typing import Dict, Tuple, Any, List
import math


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dl / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


STATUS_COPY: Dict[str, Tuple[str, str]] = {
    "REQUESTED": ("Request received", "We’re preparing dispatch."),
    "DISPATCHING": ("Finding your technician", "This usually takes a few seconds."),
    "ASSIGNED": ("Technician assigned", "You’ll see updates as they head your way."),
    "EN_ROUTE": ("On the way", "Estimated arrival shown above."),
    "ARRIVED": ("Arrived", "They’re at your location now."),
    "CHARGING": ("Charging in progress", "You’ll see energy delivered update."),
    "COMPLETED": ("Charge complete", "You’re good to go."),
    "CANCELED": ("Request canceled", "You can request again anytime."),
}

NEXT_HINT: Dict[str, str] = {
    "REQUESTED": "Confirming details.",
    "DISPATCHING": "Assigning your technician now.",
    "ASSIGNED": "They’re preparing to depart.",
    "EN_ROUTE": "They’re headed to you.",
    "ARRIVED": "Getting set up to begin charging.",
    "CHARGING": "Charging in progress.",
    "COMPLETED": "",
    "CANCELED": "",
}

UI_STATUS_MAP: Dict[str, str] = {
    "REQUESTED": "REQUEST_RECEIVED",
    "DISPATCHING": "REQUEST_RECEIVED",
    "ASSIGNED": "TECH_ASSIGNED",
    "EN_ROUTE": "ON_THE_WAY",
    "ARRIVED": "ARRIVED",
    "CHARGING": "CHARGING",
    "COMPLETED": "COMPLETE",
    "CANCELED": "CANCELED",
}

POLL_HINTS: Dict[str, int] = {
    "REQUESTED": 2,
    "DISPATCHING": 2,
    "ASSIGNED": 5,
    "EN_ROUTE": 8,
    "ARRIVED": 8,
    "CHARGING": 5,
    "COMPLETED": 30,
    "CANCELED": 30,
}

TIMELINE: List[Tuple[str, str]] = [
    ("REQUESTED", "Request received"),
    ("ASSIGNED", "Technician assigned"),
    ("EN_ROUTE", "On the way"),
    ("ARRIVED", "Arrived"),
    ("CHARGING", "Charging"),
    ("COMPLETED", "Complete"),
]

ORDER: Dict[str, int] = {s: i for i, (s, _) in enumerate(TIMELINE)}

STATUS_TO_TIMELINE_KEY: Dict[str, str] = {
    "REQUESTED": "REQUESTED",
    "DISPATCHING": "REQUESTED",
    "ASSIGNED": "ASSIGNED",
    "EN_ROUTE": "EN_ROUTE",
    "ARRIVED": "ARRIVED",
    "CHARGING": "CHARGING",
    "COMPLETED": "COMPLETED",
    "CANCELED": "REQUESTED",
}


def _calm_copy(status: str) -> Tuple[str, str]:
    return STATUS_COPY.get(status, ("In progress", "We’ll keep you updated."))


def _timeline_payload(status: str) -> List[Dict[str, Any]]:
    active_key = STATUS_TO_TIMELINE_KEY.get(status, "REQUESTED")
    current_idx = ORDER.get(active_key, 0)

    items: List[Dict[str, Any]] = []
    for key, label in TIMELINE:
        idx = ORDER[key]
        items.append(
            {
                "key": key,
                "label": label,
                "is_completed": idx < current_idx,
                "is_active": key == active_key,
            }
        )
    return items


def present_job(job) -> Dict[str, Any]:
    title, subtitle = _calm_copy(job.status)

    assigned_vehicle_label = None
    technician_name = None

    if getattr(job, "assigned_vehicle", None) is not None:
        assigned_vehicle_label = getattr(job.assigned_vehicle, "label", None)

        operator = getattr(job.assigned_vehicle, "operator", None)
        if operator is not None:
            technician_name = (
                getattr(operator, "first_name", None)
                or getattr(operator, "username", None)
                or "Technician"
            )

    ui_status = UI_STATUS_MAP.get(job.status, "IN_PROGRESS")
    poll_after_seconds = POLL_HINTS.get(job.status, 8)

    pickup_lat = getattr(job, "pickup_lat", None)
    pickup_lng = getattr(job, "pickup_lng", None)
    driver_lat = getattr(job, "driver_lat", None)
    driver_lng = getattr(job, "driver_lng", None)

    payload: Dict[str, Any] = {
        "id": str(job.id),
        "status": job.status,
        "ui_status": ui_status,
        "eta_minutes": job.eta_minutes,
        "poll_after_seconds": poll_after_seconds,
        "pickup_address": job.pickup_address,
        "pickup_lat": float(pickup_lat) if pickup_lat is not None else None,
        "pickup_lng": float(pickup_lng) if pickup_lng is not None else None,
        "customer_soc_percent": job.customer_soc_percent,
        "est_kwh_needed": str(job.est_kwh_needed),
        "assigned_vehicle_label": assigned_vehicle_label,
        "technician_name": technician_name,
        "title": title,
        "subtitle": subtitle,
        "next_hint": NEXT_HINT.get(job.status, ""),
        "timeline": _timeline_payload(job.status),
        "driver_lat": float(driver_lat) if driver_lat is not None else None,
        "driver_lng": float(driver_lng) if driver_lng is not None else None,
    }

    if (
        payload["driver_lat"] is not None
        and payload["driver_lng"] is not None
        and payload["pickup_lat"] is not None
        and payload["pickup_lng"] is not None
    ):
        dist_km = _haversine_km(
            payload["driver_lat"],
            payload["driver_lng"],
            payload["pickup_lat"],
            payload["pickup_lng"],
        )
        payload["distance_km"] = round(dist_km, 2)

        eta = max(2, int((dist_km / 35.0) * 60))
        payload["eta_minutes"] = eta

    return payload