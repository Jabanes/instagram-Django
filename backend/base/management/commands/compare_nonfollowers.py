from django.core.management.base import BaseCommand
from base.models import Follower, Following, NonFollower
from django.contrib.auth.models import User
import pandas as pd

class Command(BaseCommand):
    help = "Find users who don’t follow back and save in the database"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int, help="The ID of the logged-in Django user")

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        
        try:
            user = User.objects.get(id=user_id)

        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID '{user_id}' not found in the database."))
            return

        # Load followers and following from database instead of text files
        followers = set(Follower.objects.filter(user=user).values_list('username', flat=True))
        following = set(Following.objects.filter(user=user).values_list('username', flat=True))



        if not followers or not following:
            self.stdout.write(self.style.WARNING("⚠️ No followers or following found for this user."))
            return
    
        non_followers = sorted(following - followers)
       

        # Clear old non-followers data for this user
        NonFollower.objects.filter(user=user).delete()

        # Save new non-followers list
        NonFollower.objects.bulk_create([
            NonFollower(user=user, username=username)
            for username in non_followers
        ])
        
        
        self.stdout.write(self.style.SUCCESS(f"✅ Found {len(non_followers)} users who don’t follow back. Results saved in the database for {user.username}."))
