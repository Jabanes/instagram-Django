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

    def open_instagram(self) -> None:
        '''
        Open Instagram and wait for manual login.
        '''
        self.webdriver.get("https://www.instagram.com/")
        print("🚀 Log into Instagram manually, then press ENTER here.")
        input("Press ENTER after logging in...")

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
        '''
        Save followers to Django database instead of text file.
        '''
        if self.user:
            # Clear old followers for this user before inserting new ones
            Follower.objects.filter(user=self.user).delete()

            # Save new followers
            Follower.objects.bulk_create([
                Follower(user=self.user, username=username)
                for username in self.followers
            ])
            print(f"✅ Saved {len(self.followers)} followers for {self.user.username} in the database.")
        else:
            print("⚠️ No user found. Cannot save to database.")

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
        parser.add_argument('username', type=str, help="The username of the logged-in Django user")

    def handle(self, *args, **kwargs):
        username = kwargs['username']
        
        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User '{username}' not found in the database."))
            return

        bot = InstagramFollowers(user=user)
        bot.run()

        self.stdout.write(self.style.SUCCESS(f"Successfully saved followers for {user.username}"))
