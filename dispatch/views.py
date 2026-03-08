import json
from decimal import Decimal, InvalidOperation

from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_POST

from .models import Job, JobOffer
from .services import (
    accept_job_offer,
    begin_dispatch,
    cancel_job,
    create_job,
    decline_job_offer,
    update_job_status,
)


def _parse_json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        return None


@csrf_exempt
@login_required
@require_POST
def create_job_view(request):
    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    required_fields = ["pickup_lat", "pickup_lng"]
    missing = [field for field in required_fields if field not in data]
    if missing:
        return JsonResponse(
            {"error": f"Missing required fields: {', '.join(missing)}"},
            status=400,
        )

    try:
        pickup_lat = Decimal(str(data["pickup_lat"]))
        pickup_lng = Decimal(str(data["pickup_lng"]))
        customer_soc_percent = int(data.get("customer_soc_percent", 10))
        est_kwh_needed = Decimal(str(data.get("est_kwh_needed", "12.00")))
        eta_minutes = int(data.get("eta_minutes", 45))
    except (ValueError, TypeError, InvalidOperation):
        return JsonResponse({"error": "Invalid numeric input."}, status=400)

    pickup_address = data.get("pickup_address", "")
    idempotency_key = data.get("idempotency_key")

    try:
        job = create_job(
            customer=request.user,
            pickup_lat=pickup_lat,
            pickup_lng=pickup_lng,
            pickup_address=pickup_address,
            customer_soc_percent=customer_soc_percent,
            est_kwh_needed=est_kwh_needed,
            eta_minutes=eta_minutes,
            idempotency_key=idempotency_key,
        )

        offers = begin_dispatch(job)

        return JsonResponse(
            {
                "job_id": str(job.id),
                "status": job.status,
                "assigned_vehicle": job.assigned_vehicle.label if job.assigned_vehicle else None,
                "offers_created": len(offers),
            },
            status=201,
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@login_required
@require_GET
def job_detail_view(request, job_id):
    try:
        job = Job.objects.select_related("customer", "assigned_vehicle").get(id=job_id)
    except Job.DoesNotExist:
        return JsonResponse({"error": "Job not found."}, status=404)

    return JsonResponse(
        {
            "job_id": str(job.id),
            "customer_id": job.customer_id,
            "status": job.status,
            "pickup_lat": str(job.pickup_lat),
            "pickup_lng": str(job.pickup_lng),
            "pickup_address": job.pickup_address,
            "customer_soc_percent": job.customer_soc_percent,
            "est_kwh_needed": str(job.est_kwh_needed),
            "eta_minutes": job.eta_minutes,
            "assigned_vehicle": job.assigned_vehicle.label if job.assigned_vehicle else None,
            "created_at": job.created_at.isoformat(),
            "updated_at": job.updated_at.isoformat(),
        }
    )


@csrf_exempt
@login_required
@require_POST
def accept_offer_view(request, offer_id):
    try:
        offer = JobOffer.objects.select_related("job", "vehicle_unit").get(id=offer_id)
    except JobOffer.DoesNotExist:
        return JsonResponse({"error": "Offer not found."}, status=404)

    try:
        job = accept_job_offer(offer)
        return JsonResponse(
            {
                "job_id": str(job.id),
                "status": job.status,
                "assigned_vehicle": job.assigned_vehicle.label if job.assigned_vehicle else None,
                "accepted_offer_id": offer.id,
            }
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@login_required
@require_POST
def decline_offer_view(request, offer_id):
    try:
        offer = JobOffer.objects.select_related("job", "vehicle_unit").get(id=offer_id)
    except JobOffer.DoesNotExist:
        return JsonResponse({"error": "Offer not found."}, status=404)

    try:
        offer = decline_job_offer(offer)
        return JsonResponse(
            {
                "offer_id": offer.id,
                "job_id": str(offer.job_id),
                "status": offer.status,
            }
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@login_required
@require_POST
def update_job_status_view(request, job_id):
    data = _parse_json_body(request)
    if data is None:
        return JsonResponse({"error": "Invalid JSON body."}, status=400)

    new_status = data.get("status")
    if not new_status:
        return JsonResponse({"error": "Missing status."}, status=400)

    try:
        job = Job.objects.get(id=job_id)
    except Job.DoesNotExist:
        return JsonResponse({"error": "Job not found."}, status=404)

    try:
        job = update_job_status(job, new_status)
        return JsonResponse(
            {
                "job_id": str(job.id),
                "status": job.status,
            }
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)


@csrf_exempt
@login_required
@require_POST
def cancel_job_view(request, job_id):
    data = _parse_json_body(request)
    if data is None:
        data = {}

    reason = data.get("reason", "")

    try:
        job = Job.objects.get(id=job_id)
    except Job.DoesNotExist:
        return JsonResponse({"error": "Job not found."}, status=404)

    try:
        job = cancel_job(job, cancelled_by=request.user, reason=reason)
        return JsonResponse(
            {
                "job_id": str(job.id),
                "status": job.status,
                "reason": reason,
            }
        )
    except Exception as exc:
        return JsonResponse({"error": str(exc)}, status=400)