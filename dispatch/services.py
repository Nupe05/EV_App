from decimal import Decimal
from datetime import timedelta
from typing import Optional

from django.db import transaction
from django.utils import timezone

from fleet.models import VehicleUnit
from locations.utils import haversine_miles

from .models import Job, JobEvent, JobOffer


def log_job_event(job: Job, event_type: str, message: str = "", meta: Optional[dict] = None) -> JobEvent:
    """
    Create an audit/event record for a job.
    """
    return JobEvent.objects.create(
        job=job,
        type=event_type,
        message=message,
        meta=meta or {},
    )


def get_available_vehicle_units():
    """
    Return active vehicle units that are currently on duty.
    """
    return VehicleUnit.objects.filter(
        is_active=True,
        shifts__on_duty=True,
    ).distinct()


def rank_vehicle_units_for_job(job: Job):
    """
    Rank available vehicles by distance to pickup.
    Uses VehicleUnit.lat/lng as source of truth for now.
    """
    candidates = []

    for vehicle_unit in get_available_vehicle_units():
        try:
            distance = haversine_miles(
                float(vehicle_unit.lat),
                float(vehicle_unit.lng),
                float(job.pickup_lat),
                float(job.pickup_lng),
            )
        except (TypeError, ValueError):
            continue

        candidates.append(
            {
                "vehicle_unit": vehicle_unit,
                "distance_miles": round(distance, 2),
            }
        )

    candidates.sort(key=lambda item: item["distance_miles"])
    return candidates


@transaction.atomic
def create_job(
    *,
    customer,
    pickup_lat,
    pickup_lng,
    pickup_address: str = "",
    customer_soc_percent: int = 10,
    est_kwh_needed: Decimal = Decimal("12.00"),
    eta_minutes: int = 45,
    idempotency_key: Optional[str] = None,
) -> Job:
    """
    Create a new charging request job.
    Supports idempotency protection.
    """

    if idempotency_key:
        existing = Job.objects.filter(
            idempotency_user=customer,
            idempotency_key=idempotency_key,
        ).first()

        if existing:
            return existing

    job = Job.objects.create(
        customer=customer,
        pickup_lat=pickup_lat,
        pickup_lng=pickup_lng,
        pickup_address=pickup_address,
        customer_soc_percent=customer_soc_percent,
        est_kwh_needed=est_kwh_needed,
        eta_minutes=eta_minutes,
        idempotency_user=customer if idempotency_key else None,
        idempotency_key=idempotency_key,
    )

    log_job_event(
        job,
        "JOB_CREATED",
        "Customer created charging request",
    )

    return job


@transaction.atomic
def begin_dispatch(job: Job, offer_expiry_seconds: int = 30):
    """
    Move job into DISPATCHING and send offers.
    """

    if job.status == "REQUESTED":
        job.transition("DISPATCHING")

        log_job_event(
            job,
            "DISPATCH_STARTED",
            "Dispatch process started",
        )

    ranked = rank_vehicle_units_for_job(job)
    now = timezone.now()

    offers = []

    for candidate in ranked:
        vehicle_unit = candidate["vehicle_unit"]
        distance = candidate["distance_miles"]

        offer, created = JobOffer.objects.get_or_create(
            job=job,
            vehicle_unit=vehicle_unit,
            defaults={
                "status": JobOffer.OfferStatus.PENDING,
                "expires_at": now + timedelta(seconds=offer_expiry_seconds),
            },
        )

        if created:
            log_job_event(
                job,
                "OFFER_SENT",
                f"Offer sent to {vehicle_unit.label}",
                meta={
                    "vehicle_unit_id": vehicle_unit.id,
                    "distance_miles": distance,
                },
            )

            offers.append(offer)

    return offers


@transaction.atomic
def accept_job_offer(job_offer: JobOffer) -> Job:
    """
    Accept a dispatch offer and assign the job.
    """

    if job_offer.status != JobOffer.OfferStatus.PENDING:
        raise ValueError("Offer is not pending")

    job = job_offer.job
    now = timezone.now()

    job_offer.status = JobOffer.OfferStatus.ACCEPTED
    job_offer.responded_at = now
    job_offer.save(update_fields=["status", "responded_at"])

    job.assigned_vehicle = job_offer.vehicle_unit
    job.status = "ASSIGNED"
    job.save(update_fields=["assigned_vehicle", "status", "updated_at"])

    JobOffer.objects.filter(
        job=job,
        status=JobOffer.OfferStatus.PENDING,
    ).exclude(id=job_offer.id).update(
        status=JobOffer.OfferStatus.EXPIRED,
        responded_at=now,
    )

    log_job_event(
        job,
        "OFFER_ACCEPTED",
        f"{job_offer.vehicle_unit.label} accepted offer",
        meta={
            "vehicle_unit_id": job_offer.vehicle_unit.id,
        },
    )

    return job


@transaction.atomic
def decline_job_offer(job_offer: JobOffer) -> JobOffer:
    """
    Driver declines dispatch offer.
    """

    if job_offer.status != JobOffer.OfferStatus.PENDING:
        raise ValueError("Offer is not pending")

    job_offer.status = JobOffer.OfferStatus.DECLINED
    job_offer.responded_at = timezone.now()
    job_offer.save(update_fields=["status", "responded_at"])

    log_job_event(
        job_offer.job,
        "OFFER_DECLINED",
        f"{job_offer.vehicle_unit.label} declined offer",
        meta={
            "vehicle_unit_id": job_offer.vehicle_unit.id,
        },
    )

    return job_offer


@transaction.atomic
def expire_stale_offers() -> int:
    """
    Expire offers that passed expiration.
    """

    now = timezone.now()

    offers = JobOffer.objects.filter(
        status=JobOffer.OfferStatus.PENDING,
        expires_at__lte=now,
    )

    count = 0

    for offer in offers:
        offer.status = JobOffer.OfferStatus.EXPIRED
        offer.responded_at = now
        offer.save(update_fields=["status", "responded_at"])

        log_job_event(
            offer.job,
            "OFFER_EXPIRED",
            f"Offer expired for {offer.vehicle_unit.label}",
        )

        count += 1

    return count


@transaction.atomic
def redispatch_job(job: Job):
    """
    Return assigned job to dispatching.
    """

    if job.status != "ASSIGNED":
        raise ValueError("Job must be ASSIGNED to redispatch")

    job.assigned_vehicle = None
    job.status = "DISPATCHING"
    job.save(update_fields=["assigned_vehicle", "status", "updated_at"])

    log_job_event(
        job,
        "JOB_REDISPATCHED",
        "Job returned to dispatch queue",
    )

    return begin_dispatch(job)


@transaction.atomic
def update_job_status(job: Job, new_status: str) -> Job:
    """
    Change job status safely.
    """

    old_status = job.status
    job.transition(new_status)

    log_job_event(
        job,
        "STATUS_CHANGED",
        f"{old_status} -> {new_status}",
        meta={
            "from": old_status,
            "to": new_status,
        },
    )

    return job


@transaction.atomic
def cancel_job(job: Job, cancelled_by=None, reason: str = "") -> Job:
    """
    Cancel a job.
    """

    old_status = job.status
    job.transition("CANCELED")

    job.save(update_fields=["status", "updated_at"])

    JobOffer.objects.filter(
        job=job,
        status=JobOffer.OfferStatus.PENDING,
    ).update(
        status=JobOffer.OfferStatus.EXPIRED,
        responded_at=timezone.now(),
    )

    log_job_event(
        job,
        "JOB_CANCELED",
        f"Job canceled from {old_status}",
        meta={
            "reason": reason,
            "cancelled_by": getattr(cancelled_by, "id", None),
        },
    )

    return job