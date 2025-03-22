from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth.models import User
from .models import UserScanInfo

@receiver(post_save, sender=User)
def create_user_scan_info(sender, instance, created, **kwargs):
    if created:
        UserScanInfo.objects.get_or_create(user=instance)
