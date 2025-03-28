from django.core.management.base import BaseCommand
from base.firebase import db
from base.firebase_stores import FollowingStore
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

class InstagramFollowing:
    def __init__(self, time_sleep: int = 10, user=None) -> None:
        self.time_sleep = time_sleep
        self.following = set()
        self.user = user  # Firebase UID (str)
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

    def go_to_following(self):
        try:
            print("\U0001F50D Finding Following button...")
            following_button = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/following/')]")
            ))
            following_button.click()
            time.sleep(5)
        except Exception as e:
            print(f"⚠️ Error clicking Following button: {str(e)}")
            self.webdriver.quit()
            exit()

    def scroll_to_load_following(self):
        try:
            print("\U0001F4DC Scrolling through Following list...")
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
            print(f"⚠️ Error scrolling Following list: {str(e)}")

    def extract_following(self):
        try:
            print("\U0001F4E5 Extracting usernames...")
            scroll_box = self.webdriver.find_element(By.CLASS_NAME, "xyi19xy")
            elements = scroll_box.find_elements(By.XPATH, ".//span[@class='_ap3a _aaco _aacw _aacx _aad7 _aade']")
            for el in elements:
                self.following.add(el.text)
        except Exception as e:
            print(f"⚠️ Error extracting Following list: {str(e)}")

    def save_results_to_db(self):
        if not self.user or not self.following:
            print(f"❌ No following extracted for {self.user}.")
            return

        print(f"🔍 Fetching current following from Firestore for {self.user}...")
        collection_ref = db.collection("users").document(str(self.user)).collection("followings")
        existing_docs = list(collection_ref.stream())
        existing_following = {doc.to_dict().get("username"): doc.id for doc in existing_docs if doc.to_dict().get("username")}

        after_following = self.following
        before_following = set(existing_following.keys())

        to_add = after_following - before_following
        to_remove = before_following - after_following

        print(f"➕ To Add: {to_add}\n➖ To Remove: {to_remove}")

        for username in to_add:
            FollowingStore.add(self.user, username)
            print(f"✅ Added: {username}")

        for username in to_remove:
            doc_id = existing_following[username]
            collection_ref.document(doc_id).delete()
            print(f"❌ Removed: {username}")

        self.success = True

    def run(self):
        self.open_instagram()
        self.go_to_following()
        self.scroll_to_load_following()
        self.extract_following()
        self.save_results_to_db()
        print("🎉 Following extraction and sync complete.")
        self.webdriver.quit()


class Command(BaseCommand):
    help = "Extract following and save them in Firestore"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=str)  # now Firebase UID (str)

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        bot = InstagramFollowing(user=user_id)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"Successfully saved following for user {user_id}"))
        else:
            self.stdout.write(self.style.ERROR(f"No data extracted for user {user_id}"))