from django.urls import path

from .views import (
    accept_offer_view,
    cancel_job_view,
    create_job_view,
    decline_offer_view,
    job_detail_view,
    update_job_status_view,
)

urlpatterns = [
    path("jobs/create/", create_job_view, name="create_job"),
    path("jobs/<uuid:job_id>/", job_detail_view, name="job_detail"),
    path("jobs/<uuid:job_id>/status/", update_job_status_view, name="update_job_status"),
    path("jobs/<uuid:job_id>/cancel/", cancel_job_view, name="cancel_job"),
    path("offers/<int:offer_id>/accept/", accept_offer_view, name="accept_offer"),
    path("offers/<int:offer_id>/decline/", decline_offer_view, name="decline_offer"),
]