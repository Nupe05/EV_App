from django.contrib import admin
from .models import Address, VehicleUnitLocation


@admin.register(Address)
class AddressAdmin(admin.ModelAdmin):
    list_display = ('id', 'label', 'street', 'city', 'state', 'postal_code', 'created_at')
    search_fields = ('label', 'street', 'city', 'state', 'postal_code')


@admin.register(VehicleUnitLocation)
class VehicleUnitLocationAdmin(admin.ModelAdmin):
    list_display = ('id', 'vehicle_unit', 'latitude', 'longitude', 'recorded_at', 'is_active')
    list_filter = ('is_active', 'recorded_at')
    search_fields = ('vehicle_unit__label',)