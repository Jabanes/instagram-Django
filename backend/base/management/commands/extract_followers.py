from django.core.management.base import BaseCommand
from base.models import Follower
from django.contrib.auth.models import User
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import os
import tempfile

class InstagramFollowers:
    '''
    Extract Instagram followers and store in Django DB.
    '''
    def __init__(self, time_sleep: int = 10, user=None) -> None:
        self.time_sleep = time_sleep
        self.followers = set()
        self.user = user  # Django user
        service = Service(ChromeDriverManager().install())
        self.webdriver = webdriver.Chrome(service=service)
        self.success = False

    def open_instagram(self) -> None:
        '''
        Open Instagram and wait for manual login.
        '''
        self.webdriver.get("https://www.instagram.com/")
        print("🚀 Log into Instagram manually, then press ENTER here.")

        flag_path = os.path.join(tempfile.gettempdir(), f"ig_ready_user_{self.user.id}.flag")

        if os.path.exists(flag_path):
            os.remove(flag_path)  # Clear any previous flag
    
        # Wait for the flag file to exist
        while not os.path.exists(flag_path):
            time.sleep(1)  # Poll every second

    def go_to_followers(self) -> None:
        '''
        Click on the Followers button to open the list.
        '''
        try:
            print("🔍 Finding Followers button...")
            followers_button = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/followers/')]"))
            )
            followers_button.click()
            time.sleep(5)  # Allow time for the followers popup to load
        except Exception as e:
            print(f"⚠️ Error clicking Followers button: {str(e)}")
            self.webdriver.quit()
            exit()

    def scroll_to_load_followers(self) -> None:
        '''
        Scroll inside the followers list until all users are loaded.
        '''
        try:
            print("📜 Scrolling through followers list...")
            scroll_box = WebDriverWait(self.webdriver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "xyi19xy"))
            )

            last_height = 0
            while True:
                self.webdriver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scroll_box)
                time.sleep(5)  # Allow time for new followers to load
                new_height = self.webdriver.execute_script("return arguments[0].scrollTop", scroll_box)
                if new_height == last_height:
                    break  # Stop scrolling when no new users load
                last_height = new_height
        except Exception as e:
            print(f"⚠️ Error scrolling followers list: {str(e)}")

    def extract_followers(self) -> None:
        '''
        Extracts followers' usernames after scrolling.
        '''
        try:
            print("📥 Extracting usernames...")
            scroll_box = self.webdriver.find_element(By.CLASS_NAME, "xyi19xy")
            elements = scroll_box.find_elements(By.XPATH, ".//span[@class='_ap3a _aaco _aacw _aacx _aad7 _aade']")

            for el in elements:
                self.followers.add(el.text)

        except Exception as e:
            print(f"⚠️ Error extracting followers: {str(e)}")

    def save_results_to_db(self) -> None:
        if not self.user:
            print("⚠️ No user found. Cannot save to database.")
            return

        if not self.followers:
            print(f"❌ No followers extracted for {self.user.username}.")
            return
        
         # If we have extracted data, safely replace the old with the new
        print(f"🔄 Replacing old following list for {self.user.username}...")

        Follower.objects.filter(user=self.user).delete()

        Follower.objects.bulk_create([
            Follower(user=self.user, username=username)
            for username in self.followers
        ])
        print(f"✅ Saved {len(self.followers)} followers for {self.user.username} in the database.")
        self.success = True

    def run(self):
        '''
        Main execution function.
        '''
        self.open_instagram()
        self.go_to_followers()
        self.scroll_to_load_followers()
        self.extract_followers()
        self.save_results_to_db()
        print("🎉 Process completed! Followers saved in the database.")
        self.webdriver.quit()


class Command(BaseCommand):
    help = "Extract followers and save them in the database"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int, help="The ID of the logged-in Django user")

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID '{user_id}' not found in the database."))
            return

        bot = InstagramFollowers(user=user)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"Successfully saved followers for {user.username}"))
            print("FOLLOWERS_SAVED")  # ✅ Print a flag to catch in subprocess
        else:
            self.stdout.write(self.style.ERROR(f"Bot failed: No data extracted for user {user.username}"))
            print("NO_DATA_SAVED")  # ✅ Another flag
            exit(1)
