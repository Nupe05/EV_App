from django.conf import settings
from django.db import models
from django.utils import timezone

class ServiceZone(models.Model):
    name = models.CharField(max_length=80, unique=True)

    def __str__(self) -> str:
        return self.name

class VehicleUnit(models.Model):
    """
    Represents the mobile charging unit + assigned operator (driver).
    """
    class OperatorType(models.TextChoices):
        COMPANY = "COMPANY", "Company"
        INDEPENDENT = "INDEPENDENT", "Independent"

    label = models.CharField(max_length=50, unique=True)  # e.g. "DC-03"
    operator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="vehicle_units"
    )
    operator_type = models.CharField(max_length=20, choices=OperatorType.choices, default=OperatorType.COMPANY)

    zone = models.ForeignKey(ServiceZone, on_delete=models.SET_NULL, null=True, blank=True)

    # Demo-friendly location fields (replace later with telematics/GPS ingestion)
    lat = models.DecimalField(max_digits=9, decimal_places=6, default=38.9072, db_index=True)
    lng = models.DecimalField(max_digits=9, decimal_places=6, default=-77.0369, db_index=True)
    battery_percent = models.PositiveIntegerField(default=90)  # readiness proxy
    is_active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.label

class Shift(models.Model):
    vehicle_unit = models.ForeignKey(VehicleUnit, on_delete=models.CASCADE, related_name="shifts")
    start = models.DateTimeField(default=timezone.now)
    end = models.DateTimeField(null=True, blank=True)
    on_duty = models.BooleanField(default=True)

    def __str__(self) -> str:
        return f"{self.vehicle_unit.label} ({'ON' if self.on_duty else 'OFF'})"