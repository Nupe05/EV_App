from django.urls import path
from . import views

urlpatterns = [
    path("jobs/", views.create_job),
    path("jobs/<uuid:job_id>/", views.job_detail),
    path("jobs/<uuid:job_id>/status/", views.job_set_status),
    path("jobs/<uuid:job_id>/location/", views.job_update_location),

    path("driver/offers/", views.driver_offers_inbox),
    path("offers/<int:offer_id>/accept/", views.offer_accept),
    path("offers/<int:offer_id>/decline/", views.offer_decline),
]