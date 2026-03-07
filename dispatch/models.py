import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

from fleet.models import VehicleUnit
from .constants import JOB_STATES, ALLOWED_TRANSITIONS

class Job(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="jobs")
    assigned_vehicle = models.ForeignKey(VehicleUnit, on_delete=models.SET_NULL, null=True, blank=True)

    # Request snapshot (demo-safe)
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_address = models.CharField(max_length=255, blank=True)

    customer_soc_percent = models.PositiveIntegerField(default=10)  # EV state of charge
    est_kwh_needed = models.DecimalField(max_digits=6, decimal_places=2, default=12.00)

    status = models.CharField(max_length=20, choices=JOB_STATES, default="REQUESTED")
    eta_minutes = models.PositiveIntegerField(default=45)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def transition(self, new_status: str):
        allowed = ALLOWED_TRANSITIONS.get(self.status, set())
        if new_status not in allowed:
            raise ValueError(f"Invalid transition {self.status} -> {new_status}")
        self.status = new_status
    # dispatch/models.py (inside Job)

    # dispatch/models.py (inside Job)

    idempotency_key = models.CharField(max_length=80, blank=True, null=True, db_index=True)
    idempotency_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="idempotent_jobs",
    )

    driver_lat = models.FloatField(null=True, blank=True)
    driver_lng = models.FloatField(null=True, blank=True)
    driver_last_ping_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        constraints = [
        models.UniqueConstraint(
            fields=["idempotency_user", "idempotency_key"],
            name="uniq_job_idempotency_per_user",
        )
    ]

class JobEvent(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="events")
    at = models.DateTimeField(default=timezone.now)
    type = models.CharField(max_length=40)  # e.g. "STATUS_CHANGED", "OFFER_SENT"
    message = models.CharField(max_length=255, blank=True)
    meta = models.JSONField(default=dict, blank=True)

class JobOffer(models.Model):
    """
    A dispatch offer sent to a driver/vehicle unit. Enables decline/reassign cleanly.
    """
    class OfferStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        DECLINED = "DECLINED", "Declined"
        EXPIRED = "EXPIRED", "Expired"

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="offers")
    vehicle_unit = models.ForeignKey(VehicleUnit, on_delete=models.CASCADE, related_name="offers")

    status = models.CharField(max_length=10, choices=OfferStatus.choices, default=OfferStatus.PENDING)
    created_at = models.DateTimeField(default=timezone.now)
    responded_at = models.DateTimeField(null=True, blank=True)
    # dispatch/models.py (inside JobOffer)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        unique_together = [("job", "vehicle_unit")]