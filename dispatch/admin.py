from django.contrib import admin
from .models import Job, JobOffer, JobEvent

class JobEventInline(admin.TabularInline):
    model = JobEvent
    extra = 0
    readonly_fields = ("at", "type", "message", "meta")

class JobOfferInline(admin.TabularInline):
    model = JobOffer
    extra = 0
    readonly_fields = ("created_at", "responded_at")

@admin.register(Job)
class JobAdmin(admin.ModelAdmin):
    list_display = ("id", "customer", "status", "eta_minutes", "assigned_vehicle", "created_at")
    list_filter = ("status",)
    search_fields = ("id", "customer__username", "pickup_address")
    inlines = [JobOfferInline, JobEventInline]

@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):
    list_display = ("job", "vehicle_unit", "status", "created_at", "responded_at")
    list_filter = ("status",)

@admin.register(JobEvent)
class JobEventAdmin(admin.ModelAdmin):
    list_display = ("job", "type", "at", "message")
    list_filter = ("type",)