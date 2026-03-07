# dispatch/management/commands/expire_offers.py

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from dispatch.models import JobOffer, JobEvent
from api.dispatch_engine import dispatch_job


class Command(BaseCommand):
    help = "Expire pending offers past expires_at and re-dispatch jobs if needed."

    def handle(self, *args, **options):
        now = timezone.now()

        expired_qs = JobOffer.objects.select_related("job").filter(
            status="PENDING",
            expires_at__isnull=False,
            expires_at__lte=now,
        )

        expired_count = 0
        job_ids = set()

        with transaction.atomic():
            for offer in expired_qs:
                offer.status = "EXPIRED"
                offer.responded_at = now
                offer.save(update_fields=["status", "responded_at"])
                expired_count += 1
                job_ids.add(offer.job_id)

        redispatch_count = 0

        for job_id in job_ids:
            pending_remaining = JobOffer.objects.filter(job_id=job_id, status="PENDING").count()
            if pending_remaining != 0:
                continue

            any_offer = JobOffer.objects.select_related("job").filter(job_id=job_id).first()
            if not any_offer:
                continue

            job = any_offer.job
            if job.status == "DISPATCHING":
                dispatch_job(job)
                JobEvent.objects.create(
                    job=job,
                    type="REDISPATCH",
                    message="Re-dispatched after offer expiry",
                    meta={"at": now.isoformat()},
                )
                redispatch_count += 1

        self.stdout.write(self.style.SUCCESS(
            f"Expired {expired_count} offers; re-dispatched {redispatch_count} jobs."
        ))