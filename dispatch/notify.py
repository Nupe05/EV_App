from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from dispatch.presenter import present_job


def broadcast_job(job):
    channel_layer = get_channel_layer()
    if not channel_layer:
        return

    payload = present_job(job)

    async_to_sync(channel_layer.group_send)(
        f"job_{job.id}",
        {
            "type": "job.update",
            "payload": payload,
        },
    )