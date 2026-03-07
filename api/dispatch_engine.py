# api/dispatch_engine.py
#
# Drop-in dispatch engine with:
# - On-duty eligibility
# - DEMO_MODE preferred vehicle override
# - Offer TTL (expires_at) support
# - Safe offer re-creation/reset behavior for re-dispatch
#
# Assumes JobOffer has fields: status, expires_at, responded_at
# Assumes JobEvent exists
#
# If you haven't added `expires_at` to JobOffer yet, either:
#   - add it + migrate, OR
#   - set OFFER_TTL_SECONDS = None to disable expiry behavior.

from __future__ import annotations

from datetime import timedelta
from typing import List
from django.conf import settings
from django.utils import timezone

from fleet.models import VehicleUnit
from dispatch.models import Job, JobOffer, JobEvent


def get_on_duty_vehicle_units():
    """
    Eligible = active vehicle units that have at least one shift marked on_duty=True.
    (We keep it simple for now; you can later add end-time filtering, zones, workload, etc.)
    """
    return (
        VehicleUnit.objects.filter(
            is_active=True,
            shifts__on_duty=True,
        )
        .distinct()
    )


def dispatch_job(job: Job, top_n: int = 3) -> List[JobOffer]:
    """
    Creates (or resets) offers for eligible vehicles.

    - If DEMO_MODE and DEMO_PREFERRED_VEHICLE_LABEL is set, that vehicle is ranked first.
    - Otherwise uses a simple heuristic (battery_percent descending).
    - Creates offers for top_n vehicles.
    - If an offer already exists for a selected vehicle, it is reset to PENDING (unless accepted).

    Returns: list of JobOffer objects (selected offers).
    """
    eligible = list(get_on_duty_vehicle_units())

    demo_mode = bool(getattr(settings, "DEMO_MODE", False))
    preferred_label = getattr(settings, "DEMO_PREFERRED_VEHICLE_LABEL", None)

    # Offer TTL (seconds). Set to None/0 to disable expiry behavior.
    offer_ttl = getattr(settings, "OFFER_TTL_SECONDS", 45)
    expires_at = None
    if offer_ttl and int(offer_ttl) > 0:
        expires_at = timezone.now() + timedelta(seconds=int(offer_ttl))

    if demo_mode and preferred_label:
        eligible.sort(key=lambda vu: 0 if vu.label == preferred_label else 1)
    else:
        # Simple heuristic: higher readiness first
        eligible.sort(key=lambda vu: -vu.battery_percent)

    chosen = eligible[: max(0, int(top_n))]

    offers: List[JobOffer] = []
    for vu in chosen:
        offer, created = JobOffer.objects.get_or_create(job=job, vehicle_unit=vu)

        # If the offer is already accepted, leave it alone
        if offer.status == JobOffer.OfferStatus.ACCEPTED:
            offers.append(offer)
            continue

        # Reset/reuse offer for this dispatch wave
        offer.status = JobOffer.OfferStatus.PENDING
        offer.responded_at = None

        # Only set expires_at if the model has it (or you've migrated it)
        # If you haven't added expires_at yet, setting it will raise an AttributeError.
        if hasattr(offer, "expires_at"):
            offer.expires_at = expires_at

        # Save only fields that exist
        update_fields = ["status", "responded_at"]
        if hasattr(offer, "expires_at"):
            update_fields.append("expires_at")

        offer.save(update_fields=update_fields)
        offers.append(offer)

    JobEvent.objects.create(
        job=job,
        type="DISPATCH",
        message="Offers created",
        meta={
            "demo_mode": demo_mode,
            "preferred_label": preferred_label,
            "top_n": top_n,
            "offers": [str(o.id) for o in offers],
            "expires_at": expires_at.isoformat() if expires_at else None,
        },
    )

    return offers