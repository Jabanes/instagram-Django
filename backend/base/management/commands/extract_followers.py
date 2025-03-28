from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from base.firebase import db
from base.firebase_stores import FollowerStore
from firebase_admin import firestore
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
import time
import os
import tempfile
import pandas as pd

class InstagramFollowers:
    def __init__(self, time_sleep: int = 10, user=None) -> None:
        self.time_sleep = time_sleep
        self.followers = set()
        self.user = user
        self.success = False
        service = Service(ChromeDriverManager().install())
        self.webdriver = webdriver.Chrome(service=service)

    def open_instagram(self):
        self.webdriver.get("https://www.instagram.com/")
        print("\U0001F680 Log into Instagram manually, then press ENTER here.")
        flag_path = os.path.join(tempfile.gettempdir(), f"ig_ready_user_{self.user}.flag")
        if os.path.exists(flag_path):
            os.remove(flag_path)
        while not os.path.exists(flag_path):
            time.sleep(1)

    def go_to_followers(self):
        try:
            print("\U0001F50D Finding Followers button...")
            followers_button = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/followers/')]")
            ))
            followers_button.click()
            time.sleep(5)
        except Exception as e:
            print(f"⚠️ Error clicking Followers button: {str(e)}")
            self.webdriver.quit()
            exit()

    def scroll_to_load_followers(self):
        try:
            print("\U0001F4DC Scrolling through followers list...")
            scroll_box = WebDriverWait(self.webdriver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "xyi19xy"))
            )
            last_height = 0
            while True:
                self.webdriver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scroll_box)
                time.sleep(5)
                new_height = self.webdriver.execute_script("return arguments[0].scrollTop", scroll_box)
                if new_height == last_height:
                    break
                last_height = new_height
        except Exception as e:
            print(f"⚠️ Error scrolling followers list: {str(e)}")

    def extract_followers(self):
        try:
            print("\U0001F4E5 Extracting usernames...")
            scroll_box = self.webdriver.find_element(By.CLASS_NAME, "xyi19xy")
            elements = scroll_box.find_elements(By.XPATH, ".//span[@class='_ap3a _aaco _aacw _aacx _aad7 _aade']")
            for el in elements:
                self.followers.add(el.text)
        except Exception as e:
            print(f"⚠️ Error extracting followers: {str(e)}")

    def save_results_to_db(self):
        if not self.user or not self.followers:
            print(f"❌ No followers extracted for {self.user}.")
            return

        print(f"🔍 Fetching current followers from Firestore for {self.user}...")
        collection_ref = db.collection("users").document(str(self.user)).collection("followers")
        existing_docs = list(collection_ref.stream())
        existing_followers = {doc.to_dict().get("username"): doc.id for doc in existing_docs if doc.to_dict().get("username")}

        after_followers = self.followers
        before_followers = set(existing_followers.keys())

        to_add = after_followers - before_followers
        to_remove = before_followers - after_followers

        print(f"➕ To Add: {to_add}\n➖ To Remove: {to_remove}")

        for username in to_add:
            FollowerStore.add(self.user, username)
            print(f"✅ Added: {username}")

        for username in to_remove:
            doc_id = existing_followers[username]
            collection_ref.document(doc_id).delete()
            print(f"❌ Removed: {username}")

        self.success = True

    def run(self):
        self.open_instagram()
        self.go_to_followers()
        self.scroll_to_load_followers()
        self.extract_followers()
        self.save_results_to_db()
        print("🎉 Followers extraction and sync complete.")
        self.webdriver.quit()


class Command(BaseCommand):
    help = "Extract followers and save them in Firestore"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int)

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        try:
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f"User with ID {user_id} not found."))
            return

        bot = InstagramFollowers(user=user)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"Successfully saved followers for {user.username}"))
        else:
            self.stdout.write(self.style.ERROR(f"No data extracted for {user.username}"))
