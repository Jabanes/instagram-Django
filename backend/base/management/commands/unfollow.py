from django.core.management.base import BaseCommand
from base.firebase_stores import NonFollowerStore, FollowingStore
from base.firebase import db
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import random
import os
import tempfile

class InstagramUnfollower:
    def __init__(self, user=None, time_sleep: int = 10):
        self.user = user  # Firebase UID (str)
        self.time_sleep = time_sleep
        self.success = False
        self.unfollowed = []
        service = Service(ChromeDriverManager().install())
        options = webdriver.ChromeOptions()
        options.add_argument("--disable-notifications")
        self.webdriver = webdriver.Chrome(service=service, options=options)

    def wait(self):
        time.sleep(random.uniform(2, 5))

    def load_non_followers(self):
        return [n['username'] for n in NonFollowerStore.list(self.user)]

    def open_instagram(self):
        self.webdriver.get("https://www.instagram.com/")
        print("\U0001F680 Log into Instagram manually, then press ENTER here.")
        flag_path = os.path.join(tempfile.gettempdir(), f"ig_ready_user_{self.user}.flag")

        if os.path.exists(flag_path):
            os.remove(flag_path)

        while not os.path.exists(flag_path):
            time.sleep(1)

    def unfollow_user(self, username):
        self.webdriver.get(f"https://www.instagram.com/{username}/")
        self.wait()

        try:
            follow_button = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//div[contains(text(), 'Following')]"))
            )
            follow_button.click()
            self.wait()

            unfollow_confirm = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Unfollow')]"))
            )
            unfollow_confirm.click()
            self.wait()

            print(f"✅ Unfollowed {username}")
            return True

        except Exception as e:
            print(f"⚠️ Could not unfollow {username}: {str(e)}")
            return False

    def save_results_to_db(self):
        if not self.unfollowed:
            print("📭 No users were unfollowed. Nothing to update.")
            return

        # Remove from NonFollower list
        for username in self.unfollowed:
            NonFollowerStore.delete(self.user, username)
            FollowingStore.delete(self.user, username)

        print(f"🗑️ Removed {len(self.unfollowed)} users from NonFollower and Following collections.")
        self.success = True

        flag_path = os.path.join(tempfile.gettempdir(), f"new_data_flag_user_{self.user}.flag")
        with open(flag_path, "w") as f:
            f.write("new_data")
        print("📌 Change detected — flag file written for frontend.")

    def run(self):
        self.open_instagram()
        usernames = self.load_non_followers()

        if not usernames:
            print("⚠️ No non-followers found. Exiting.")
            self.webdriver.quit()
            return

        for username in usernames:
            if self.unfollow_user(username):
                self.unfollowed.append(username)

        self.save_results_to_db()
        self.webdriver.quit()


class Command(BaseCommand):
    help = "Unfollow users who don’t follow back (Firebase version)"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=str, help="The Firebase UID of the user")

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']

        bot = InstagramUnfollower(user=user_id)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"Successfully unfollowed users for {user_id}"))
            print("UNFOLLOW_SUCCESS")
        else:
            self.stdout.write(self.style.WARNING(f"No users were unfollowed for {user_id}"))
            print("NO_UNFOLLOW_NEEDED")
