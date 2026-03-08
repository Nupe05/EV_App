from typing import Optional

from .models import VehicleUnitLocation
from .utils import haversine_miles


def get_latest_vehicle_unit_location(vehicle_unit) -> Optional[VehicleUnitLocation]:
    return vehicle_unit.location_history.order_by('-recorded_at').first()


def distance_from_vehicle_unit_to_point(vehicle_unit, target_lat: float, target_lon: float) -> Optional[float]:
    latest = get_latest_vehicle_unit_location(vehicle_unit)
    if not latest:
        return None

    return haversine_miles(
        float(latest.latitude),
        float(latest.longitude),
        target_lat,
        target_lon,
    )