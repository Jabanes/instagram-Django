from django.core.management.base import BaseCommand
from base.models import NonFollower
from django.contrib.auth.models import User
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import random

class InstagramUnfollower:
    '''
    Automatically unfollows non-followers on Instagram.
    '''
    def __init__(self, user=None):
        self.user = user  # Django user
        options = webdriver.ChromeOptions()
        options.add_argument("--disable-notifications")  # Prevent popups
        self.driver = webdriver.Chrome(options=options)

    def wait(self):
        """Random wait time to mimic human behavior."""
        time.sleep(random.uniform(2, 5))

    def load_non_followers(self):
        """Fetch non-followers from the Django database."""
        if self.user:
            return list(NonFollower.objects.filter(user=self.user).values_list('username', flat=True))
        else:
            print("⚠️ No user found. Cannot load non-followers.")
            return []

    def unfollow_user(self, username):
        """Unfollows a specific user on Instagram."""
        self.driver.get(f"https://www.instagram.com/{username}/")
        self.wait()

        try:
            # Wait for the "Following" button
            follow_button = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Following')]"))
            )
            follow_button.click()
            self.wait()

            # Wait for the "Unfollow" confirmation button inside the pop-up
            unfollow_confirm = WebDriverWait(self.driver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Unfollow')]"))
            )
            unfollow_confirm.click()
            self.wait()

            print(f"✅ Unfollowed {username} successfully.")
            return True

        except Exception as e:
            print(f"⚠️ Could not unfollow {username}: {str(e)}")
            return False

    def run(self):
        """Runs the bot."""
        usernames = self.load_non_followers()

        if not usernames:
            print("⚠️ No non-followers found in the database. Exiting.")
            self.driver.quit()
            return

        self.driver.get("https://www.instagram.com/")
        print("🚀 Log into Instagram manually, then press ENTER here.")
        input("Press ENTER after logging in...")

        for username in usernames:
            success = self.unfollow_user(username)
            if success:
                # Remove the unfollowed user from the database
                NonFollower.objects.filter(user=self.user, username=username).delete()

        print("\n🎉 Unfollow process completed!")
        self.driver.quit()


class Command(BaseCommand):
    help = "Unfollow users who don’t follow back"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int, help="The ID of the logged-in Django user")

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID '{user_id}' not found in the database."))
            return

        bot = InstagramUnfollower(user=user)
        bot.run()

        self.stdout.write(self.style.SUCCESS(f"Successfully unfollowed users for {user.username}"))
