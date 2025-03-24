from django.core.management.base import BaseCommand
import pandas as pd
from base.models import Following
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

class InstagramFollowing:
    '''
    Extract Instagram following and store in Django DB.
    '''
    def __init__(self, time_sleep: int = 10, user=None) -> None:
        self.time_sleep = time_sleep
        self.following = set()
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


    def go_to_following(self) -> None:
        '''
        Click on the Following button to open the list.
        '''
        try:
            print("🔍 Finding Following button...")
            following_button = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/following/')]"))
            )
            following_button.click()
            time.sleep(5)  # Allow time for the following popup to load
        except Exception as e:
            print(f"⚠️ Error clicking Following button: {str(e)}")
            self.webdriver.quit()
            exit()

    def scroll_to_load_following(self) -> None:
        '''
        Scroll inside the following list until all users are loaded.
        '''
        try:
            print("📜 Scrolling through Following list...")
            scroll_box = WebDriverWait(self.webdriver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "xyi19xy"))
            )

            last_height = 0
            while True:
                self.webdriver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scroll_box)
                time.sleep(5)  # Allow time for new users to load
                new_height = self.webdriver.execute_script("return arguments[0].scrollTop", scroll_box)
                if new_height == last_height:
                    break  # Stop scrolling when no new users load
                last_height = new_height
        except Exception as e:
            print(f"⚠️ Error scrolling Following list: {str(e)}")

    def extract_following(self) -> None:
        '''
        Extracts following usernames after scrolling.
        '''
        try:
            print("📥 Extracting usernames...")
            scroll_box = self.webdriver.find_element(By.CLASS_NAME, "xyi19xy")
            elements = scroll_box.find_elements(By.XPATH, ".//span[@class='_ap3a _aaco _aacw _aacx _aad7 _aade']")

            for el in elements:
                self.following.add(el.text)

        except Exception as e:
            print(f"⚠️ Error extracting Following list: {str(e)}")

    def save_results_to_db(self) -> None:
        if not self.user:
            print("⚠️ No user found. Cannot save to database.")
            return
        if not self.following:
            print(f"❌ No following extracted for {self.user.username}. Keeping existing data untouched.")
            return

        print(f"🔍 Fetching current DB following for {self.user.username}...")
        # Fetch current following as a DataFrame for comparison
        current_following = pd.DataFrame(Following.objects.filter(user=self.user).values_list("username", flat=True), columns=["username"])

        # Store the before-following data
        self.before_following = current_following

        # Store the after-following data
        self.after_following = pd.DataFrame(list(self.following), columns=["username"])

        # Compare the two dataframes
        merged = pd.merge(self.before_following, self.after_following, on="username", how="outer", indicator=True)

        to_add = merged[merged["_merge"] == "right_only"]["username"]
        to_remove = merged[merged["_merge"] == "left_only"]["username"]


        print(f"➕ New following to add: {to_add}")
        print(f"➖ Old following to remove: {to_remove}")

        # Add new following
        Following.objects.bulk_create([
            Following(user=self.user, username=username)
            for username in to_add
        ])

        # Remove old following
        Following.objects.filter(user=self.user, username__in=to_remove).delete()

        # Set the flag only if there's new data
        if not to_add.empty or not to_remove.empty:
            print("📌 Change detected! Creating frontend trigger flag.")
            flag_path = os.path.join(tempfile.gettempdir(), f"new_data_flag_user_{self.user.id}.flag")
            with open(flag_path, "w") as f:
                f.write("new_data")

        print(f"✅ Synced following for {self.user.username}: +{len(to_add)}, -{len(to_remove)}")
        self.success = len(self.following) > 0



    def run(self):
        '''
        Main execution function.
        '''
        self.open_instagram()
        self.go_to_following()
        self.scroll_to_load_following()
        self.extract_following()
        self.save_results_to_db()
        print("🎉 Process completed! Followers saved in the database.")
        self.webdriver.quit()


class Command(BaseCommand):
    help = "Extract following and save them in the database"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int, help="The ID of the logged-in Django user")

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID '{user_id}' not found in the database."))
            return

        bot = InstagramFollowing(user=user)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"Successfully saved following for {user.username}"))
            print("FOLLOWING_SAVED")  # ✅ Print a flag to catch in subprocess
        else:
            self.stdout.write(self.style.ERROR(f"Bot failed: No data extracted for user {user.username}"))
            print("NO_DATA_SAVED")  # ✅ Another flag
            exit(1)
        
