from django.contrib import admin
from .models import Job, JobOffer, JobEvent


class JobEventInline(admin.TabularInline):
    model = JobEvent
    extra = 0
    readonly_fields = ("at", "type", "message", "meta")
    ordering = ("at",)


class JobOfferInline(admin.TabularInline):
    model = JobOffer
    extra = 0
    readonly_fields = ("created_at", "responded_at", "expires_at")
    ordering = ("-created_at",)


@admin.register(Job)
class JobAdmin(admin.ModelAdmin):

    list_display = (
        "id",
        "customer",
        "status",
        "assigned_vehicle",
        "eta_minutes",
        "created_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "id",
        "customer__username",
        "pickup_address",
    )

    readonly_fields = (
        "created_at",
        "updated_at",
    )

    date_hierarchy = "created_at"

    inlines = [
        JobOfferInline,
        JobEventInline,
    ]

    ordering = ("-created_at",)


@admin.register(JobOffer)
class JobOfferAdmin(admin.ModelAdmin):

    list_display = (
        "job",
        "vehicle_unit",
        "status",
        "created_at",
        "responded_at",
        "expires_at",
    )

    list_filter = (
        "status",
        "created_at",
    )

    search_fields = (
        "job__id",
        "vehicle_unit__label",
    )

    ordering = ("-created_at",)


@admin.register(JobEvent)
class JobEventAdmin(admin.ModelAdmin):

    list_display = (
        "job",
        "type",
        "at",
        "message",
    )

    list_filter = (
        "type",
    )

    search_fields = (
        "job__id",
        "message",
    )

    ordering = ("-at",)