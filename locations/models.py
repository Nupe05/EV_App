from django.db import models


class Address(models.Model):
    label = models.CharField(max_length=100, blank=True)
    street = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=50, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        parts = [self.label or self.street, self.city, self.state]
        return ", ".join([p for p in parts if p])


class VehicleUnitLocation(models.Model):
    vehicle_unit = models.ForeignKey(
        'fleet.VehicleUnit',
        on_delete=models.CASCADE,
        related_name='location_history'
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    recorded_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.vehicle_unit} @ ({self.latitude}, {self.longitude})"