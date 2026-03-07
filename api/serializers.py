from rest_framework import serializers
from dispatch.models import Job, JobOffer, JobEvent

class JobCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ["pickup_lat", "pickup_lng", "pickup_address", "customer_soc_percent", "est_kwh_needed"]

    def create(self, validated_data):
        user = self.context["request"].user
        return Job.objects.create(customer=user, **validated_data)

class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = ["id", "status", "eta_minutes", "pickup_address", "customer_soc_percent", "est_kwh_needed",
                  "assigned_vehicle", "created_at", "updated_at"]

class JobOfferSerializer(serializers.ModelSerializer):
    vehicle_label = serializers.CharField(source="vehicle_unit.label", read_only=True)

    class Meta:
        model = JobOffer
        fields = ["id", "job", "vehicle_unit", "vehicle_label", "status", "created_at", "responded_at"]

class JobEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobEvent
        fields = ["id", "at", "type", "message", "meta"]