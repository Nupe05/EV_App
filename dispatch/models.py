import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

from fleet.models import VehicleUnit
from .constants import JOB_STATES, ALLOWED_TRANSITIONS


class Job(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="jobs"
    )

    assigned_vehicle = models.ForeignKey(
        VehicleUnit,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="assigned_jobs"
    )

    # Request snapshot (demo-safe)
    pickup_lat = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_lng = models.DecimalField(max_digits=9, decimal_places=6)
    pickup_address = models.CharField(max_length=255, blank=True)

    customer_soc_percent = models.PositiveIntegerField(default=10)
    est_kwh_needed = models.DecimalField(max_digits=6, decimal_places=2, default=12.00)

    status = models.CharField(
        max_length=20,
        choices=JOB_STATES,
        default="REQUESTED",
        db_index=True
    )

    eta_minutes = models.PositiveIntegerField(default=45)

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    # Idempotency protection for duplicate API requests
    idempotency_key = models.CharField(max_length=80, blank=True, null=True, db_index=True)

    idempotency_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="idempotent_jobs"
    )

    # Demo driver tracking
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

    def __str__(self):
        return f"Job {self.id} ({self.status})"

    def transition(self, new_status: str, save: bool = True):
        allowed = ALLOWED_TRANSITIONS.get(self.status, set())

        if new_status not in allowed:
            raise ValueError(f"Invalid transition {self.status} -> {new_status}")

        self.status = new_status

        if save:
            self.save(update_fields=["status", "updated_at"])


class JobEvent(models.Model):
    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="events"
    )

    at = models.DateTimeField(default=timezone.now)
    type = models.CharField(max_length=40)  # STATUS_CHANGED, OFFER_SENT, etc
    message = models.CharField(max_length=255, blank=True)
    meta = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["at"]

    def __str__(self):
        return f"{self.type} @ {self.at} for Job {self.job_id}"


class JobOffer(models.Model):
    """
    A dispatch offer sent to a driver/vehicle unit.
    Enables decline/reassign workflows similar to rideshare systems.
    """

    class OfferStatus(models.TextChoices):
        PENDING = "PENDING", "Pending"
        ACCEPTED = "ACCEPTED", "Accepted"
        DECLINED = "DECLINED", "Declined"
        EXPIRED = "EXPIRED", "Expired"

    job = models.ForeignKey(
        Job,
        on_delete=models.CASCADE,
        related_name="offers"
    )

    vehicle_unit = models.ForeignKey(
        VehicleUnit,
        on_delete=models.CASCADE,
        related_name="offers"
    )

    status = models.CharField(
        max_length=10,
        choices=OfferStatus.choices,
        default=OfferStatus.PENDING,
        db_index=True
    )

    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    expires_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["job", "vehicle_unit"],
                name="uniq_offer_per_job_vehicle_unit",
            )
        ]

    def __str__(self):
        return f"Offer for Job {self.job_id} -> {self.vehicle_unit} ({self.status})"