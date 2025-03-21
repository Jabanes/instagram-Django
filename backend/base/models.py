from django.db import models
from django.contrib.auth.models import User  # Django's built-in User model

class Follower(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # The user whose followers we store
    username = models.CharField(max_length=255)  # The follower's username

    def __str__(self):
        return f"{self.user.username} - {self.username}"

class Following(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # The user whose followings we store
    username = models.CharField(max_length=255)  # The following's username

    def __str__(self):
        return f"{self.user.username} - {self.username}"

class NonFollower(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)  # The user whose non-followers we store
    username = models.CharField(max_length=255)  # The non-follower's username

    def __str__(self):
        return f"{self.user.username} - {self.username}"
    
class UserScanInfo(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="scan_info")
    last_following_scan = models.DateTimeField(null=True, blank=True)
    last_followers_scan = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"Scan Info for {self.user.username}"