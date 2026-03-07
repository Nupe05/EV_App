from django.contrib import admin
from .models import ServiceZone, VehicleUnit, Shift

@admin.register(ServiceZone)
class ServiceZoneAdmin(admin.ModelAdmin):
    list_display = ("name",)

@admin.register(VehicleUnit)
class VehicleUnitAdmin(admin.ModelAdmin):
    list_display = ("label", "operator", "operator_type", "zone", "battery_percent", "is_active")
    list_filter = ("operator_type", "zone", "is_active")
    search_fields = ("label", "operator__username")

@admin.register(Shift)
class ShiftAdmin(admin.ModelAdmin):
    list_display = ("vehicle_unit", "on_duty", "start", "end")
    list_filter = ("on_duty",)