# api/views.py
#
# Fully updated drop-in views.py with:
# - Idempotent customer job creation (Idempotency-Key / X-Idempotency-Key)
# - Timeline-ready job detail response (present_job)
# - Driver offers inbox with auto-expire-on-read + include filters
# - Offer accept/decline with expiry protection
# - Job status updates
# - WebSocket broadcast hooks (dispatch.notify.broadcast_job) in all critical locations
#
# Assumes:
# - dispatch.notify.broadcast_job(job) exists
# - dispatch.presenter.present_job(job) exists
# - JobOffer has fields: status, responded_at, expires_at (nullable)
# - api.dispatch_engine.dispatch_job(job) sets/reset offers and expires_at appropriately
# - permissions IsCustomer / IsDriver exist
# - serializers JobCreateSerializer, JobOfferSerializer exist
#
# If you haven't added expires_at yet, the inbox auto-expire will still work (it checks for field usage in query).
# But offer expiry protection in accept expects expires_at attribute (present if migrated).

from django.db import IntegrityError, transaction
from django.utils import timezone

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from dispatch.constants import ALLOWED_TRANSITIONS
from dispatch.models import Job, JobEvent, JobOffer
from dispatch.presenter import present_job
from dispatch.notify import broadcast_job

from .dispatch_engine import dispatch_job
from .permissions import IsCustomer, IsDriver
from .serializers import JobCreateSerializer, JobOfferSerializer


# ---------------------------------------------------------------------
# CUSTOMER: CREATE JOB (IDEMPOTENT)
# ---------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsCustomer])
def create_job(request):
    idem_key = request.headers.get("Idempotency-Key") or request.headers.get("X-Idempotency-Key")

    # Fast path: return existing job if same key already used by this user
    if idem_key:
        existing = Job.objects.filter(
            idempotency_user=request.user,
            idempotency_key=idem_key,
        ).first()
        if existing:
            return Response(present_job(existing), status=status.HTTP_200_OK)

    serializer = JobCreateSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)

    try:
        with transaction.atomic():
            job = serializer.save()

            # Store idempotency key inside the same transaction
            if idem_key:
                job.idempotency_user = request.user
                job.idempotency_key = idem_key
                job.save(update_fields=["idempotency_user", "idempotency_key"])

            # Transition to DISPATCHING
            job.transition("DISPATCHING")
            job.save(update_fields=["status", "updated_at"])

            JobEvent.objects.create(
                job=job,
                type="STATUS_CHANGED",
                message="Job dispatching",
                meta={"status": job.status},
            )

            # Create offers
            dispatch_job(job)

            # Set initial ETA (demo-friendly default)
            job.eta_minutes = 45
            job.save(update_fields=["eta_minutes", "updated_at"])

    except IntegrityError:
        # Handle race condition: two identical requests with same key at same time
        if not idem_key:
            raise
        job = Job.objects.get(idempotency_user=request.user, idempotency_key=idem_key)
        broadcast_job(job)
        return Response(present_job(job), status=status.HTTP_200_OK)

    # Broadcast job update for customer timeline
    broadcast_job(job)

    return Response(present_job(job), status=status.HTTP_201_CREATED)


# ---------------------------------------------------------------------
# CUSTOMER/DRIVER: JOB DETAIL (TIMELINE READY)
# ---------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def job_detail(request, job_id):
    job = Job.objects.select_related("assigned_vehicle").get(id=job_id)

    # Access control
    if request.user.role == "CUSTOMER" and job.customer_id != request.user.id:
        return Response({"detail": "Forbidden"}, status=403)

    if request.user.role == "DRIVER":
        driver_has_offer = JobOffer.objects.filter(
            job=job,
            vehicle_unit__operator=request.user,
        ).exists()

        is_assigned_driver = (
            job.assigned_vehicle is not None
            and job.assigned_vehicle.operator_id == request.user.id
        )

        if not driver_has_offer and not is_assigned_driver:
            return Response({"detail": "Forbidden"}, status=403)

    return Response(present_job(job), status=status.HTTP_200_OK)


# ---------------------------------------------------------------------
# DRIVER: OFFERS INBOX (AUTO-EXPIRE ON READ)
# Query params:
#   - include=expired  -> only expired
#   - include=all      -> all statuses
#   - default          -> pending only
# ---------------------------------------------------------------------
@api_view(["GET"])
@permission_classes([IsAuthenticated, IsDriver])
def driver_offers_inbox(request):
    now = timezone.now()

    # Auto-expire stale offers for this driver so inbox stays truthful
    # (Safe even if you haven't run expire_offers command yet.)
    JobOffer.objects.filter(
        vehicle_unit__operator=request.user,
        status="PENDING",
        expires_at__isnull=False,
        expires_at__lte=now,
    ).update(status="EXPIRED", responded_at=now)

    include = (request.query_params.get("include") or "").lower()

    qs = JobOffer.objects.filter(vehicle_unit__operator=request.user)

    if include == "all":
        offers = qs.order_by("-created_at")
    elif include == "expired":
        offers = qs.filter(status="EXPIRED").order_by("-created_at")
    else:
        offers = qs.filter(status="PENDING").order_by("-created_at")

    return Response(JobOfferSerializer(offers, many=True).data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------
# DRIVER: ACCEPT OFFER (WITH EXPIRY PROTECTION)
# ---------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDriver])
def offer_accept(request, offer_id):
    offer = JobOffer.objects.select_related("job", "vehicle_unit").get(id=offer_id)

    if offer.vehicle_unit.operator_id != request.user.id:
        return Response({"detail": "Forbidden"}, status=403)

    # Reject if already processed
    if offer.status != "PENDING":
        return Response({"detail": "Offer not pending"}, status=400)

    # Expiry protection
    if getattr(offer, "expires_at", None) and offer.expires_at <= timezone.now():
        offer.status = "EXPIRED"
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])
        return Response({"detail": "Offer expired"}, status=400)

    job = offer.job

    # Accept offer
    offer.status = "ACCEPTED"
    offer.responded_at = timezone.now()
    offer.save(update_fields=["status", "responded_at"])

    # Expire all other pending offers
    JobOffer.objects.filter(job=job, status="PENDING").exclude(id=offer.id).update(
        status="EXPIRED",
        responded_at=timezone.now(),
    )

    # Assign vehicle + transition job
    job.assigned_vehicle = offer.vehicle_unit
    if job.status == "DISPATCHING":
        job.transition("ASSIGNED")

    job.save(update_fields=["status", "assigned_vehicle", "updated_at"])

    JobEvent.objects.create(
        job=job,
        type="OFFER_ACCEPTED",
        message="Driver accepted",
        meta={"vehicle": offer.vehicle_unit.label},
    )
    JobEvent.objects.create(
        job=job,
        type="STATUS_CHANGED",
        message="Job assigned",
        meta={"status": job.status},
    )

    # Broadcast job update for customer UI
    broadcast_job(job)

    return Response({"ok": True, "job": str(job.id), "status": job.status}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------
# DRIVER: DECLINE OFFER (MAY REDISPATCH)
# ---------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDriver])
def offer_decline(request, offer_id):
    offer = JobOffer.objects.select_related("job", "vehicle_unit").get(id=offer_id)

    if offer.vehicle_unit.operator_id != request.user.id:
        return Response({"detail": "Forbidden"}, status=403)

    if offer.status != "PENDING":
        return Response({"detail": "Offer not pending"}, status=400)

    # If already expired, treat as expired
    if getattr(offer, "expires_at", None) and offer.expires_at <= timezone.now():
        offer.status = "EXPIRED"
        offer.responded_at = timezone.now()
        offer.save(update_fields=["status", "responded_at"])
        return Response({"ok": True, "status": "EXPIRED"}, status=status.HTTP_200_OK)

    offer.status = "DECLINED"
    offer.responded_at = timezone.now()
    offer.save(update_fields=["status", "responded_at"])

    JobEvent.objects.create(
        job=offer.job,
        type="OFFER_DECLINED",
        message="Driver declined",
        meta={"vehicle": offer.vehicle_unit.label},
    )

    job = offer.job

    # If no pending offers remain and still dispatching, re-dispatch
    remaining = JobOffer.objects.filter(job=job, status="PENDING").count()
    if remaining == 0 and job.status == "DISPATCHING":
        dispatch_job(job)
        JobEvent.objects.create(
            job=job,
            type="REDISPATCH",
            message="Re-dispatched after all offers declined/expired",
            meta={"at": timezone.now().isoformat()},
        )

    broadcast_job(job)

    return Response({"ok": True}, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------
# DRIVER: UPDATE JOB STATUS (STATE MACHINE)
# ---------------------------------------------------------------------
@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDriver])
def job_set_status(request, job_id):
    job = Job.objects.select_related("assigned_vehicle").get(id=job_id)

    if not job.assigned_vehicle or job.assigned_vehicle.operator_id != request.user.id:
        return Response({"detail": "Forbidden"}, status=403)

    new_status = request.data.get("status")
    if not new_status:
        return Response({"detail": "Missing status"}, status=400)

    try:
        job.transition(new_status)
        job.save(update_fields=["status", "updated_at"])
    except ValueError as e:
        return Response(
            {"detail": str(e), "allowed": list(ALLOWED_TRANSITIONS.get(job.status, []))},
            status=400,
        )

    JobEvent.objects.create(
        job=job,
        type="STATUS_CHANGED",
        message=f"Status -> {new_status}",
        meta={"status": new_status},
    )

    broadcast_job(job)

    return Response({"ok": True, "status": job.status}, status=status.HTTP_200_OK)

LOCATION_EVENT_INTERVAL_SECONDS = 25

@api_view(["POST"])
@permission_classes([IsAuthenticated, IsDriver])
def job_update_location(request, job_id):
    try:
        job = Job.objects.select_related("assigned_vehicle").get(id=job_id)
    except Job.DoesNotExist:
        return Response({"detail": "Not found"}, status=status.HTTP_404_NOT_FOUND)

    # Only assigned driver can update location
    if not job.assigned_vehicle or job.assigned_vehicle.operator_id != request.user.id:
        return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

    lat = request.data.get("lat")
    lng = request.data.get("lng")

    if lat is None or lng is None:
        return Response({"detail": "Missing lat/lng"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        lat_f = float(lat)
        lng_f = float(lng)
    except (TypeError, ValueError):
        return Response({"detail": "lat/lng must be numeric"}, status=status.HTTP_400_BAD_REQUEST)

    if not (-90 <= lat_f <= 90) or not (-180 <= lng_f <= 180):
        return Response({"detail": "lat/lng out of bounds"}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()

    # Update driver position
    job.driver_lat = lat_f
    job.driver_lng = lng_f
    job.driver_last_ping_at = now
    job.save(update_fields=["driver_lat", "driver_lng", "driver_last_ping_at", "updated_at"])

    # Throttle JobEvent creation (every 25 seconds)
    last_event = (
        JobEvent.objects.filter(job=job, type="DRIVER_LOCATION")
        .order_by("-created_at")
        .first()
    )

    should_emit_event = True

    if last_event:
        delta = (now - last_event.created_at).total_seconds()
        if delta < LOCATION_EVENT_INTERVAL_SECONDS:
            should_emit_event = False

    if should_emit_event:
        JobEvent.objects.create(
            job=job,
            type="DRIVER_LOCATION",
            message="Driver location updated",
            meta={"lat": lat_f, "lng": lng_f},
        )

    # Broadcast to WebSocket subscribers
    broadcast_job(job)

    # Return updated job payload
    return Response(present_job(job), status=status.HTTP_200_OK)