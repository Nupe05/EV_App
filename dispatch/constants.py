JOB_STATES = (
    ("REQUESTED", "Requested"),
    ("DISPATCHING", "Dispatching"),
    ("ASSIGNED", "Assigned"),
    ("EN_ROUTE", "En Route"),
    ("ARRIVED", "Arrived"),
    ("CHARGING", "Charging"),
    ("COMPLETED", "Completed"),
    ("CANCELED", "Canceled"),
)

ALLOWED_TRANSITIONS = {
    "REQUESTED": {"DISPATCHING", "CANCELED"},
    "DISPATCHING": {"ASSIGNED", "CANCELED"},
    "ASSIGNED": {"EN_ROUTE", "CANCELED"},
    "EN_ROUTE": {"ARRIVED", "CANCELED"},
    "ARRIVED": {"CHARGING", "CANCELED"},
    "CHARGING": {"COMPLETED", "CANCELED"},
    "COMPLETED": set(),
    "CANCELED": set(),
}