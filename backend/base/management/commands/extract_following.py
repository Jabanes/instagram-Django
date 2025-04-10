from django.core.management.base import BaseCommand
from base.firebase import db
from firebase_admin import firestore
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time
import os
from selenium.common.exceptions import StaleElementReferenceException, NoSuchElementException

from dotenv import load_dotenv

load_dotenv()

HEADLESS_MODE = os.getenv("HEADLESS", "false").lower() == "true"

class InstagramFollowing:
    def __init__(self, time_sleep: int = 10, user=None, cookies=None, profile_url=None) -> None:
        self.time_sleep = time_sleep
        self.user = user  # Firebase UID (str)
        self.following = set()
        self.existing_following = {}
        self.success = False
        self.cookies = cookies or []
        self.profile_url = profile_url
        self.seen_usernames_all = set()


        environment = os.getenv("ENVIRONMENT", "local")
        chrome_bin_path = os.getenv("CHROME_BIN", "")
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

        chrome_options = uc.ChromeOptions()

        if HEADLESS_MODE:
            chrome_options.add_argument("--headless=new")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-software-rasterizer")
        chrome_options.add_argument("--window-size=1920,1080")

        # Decide which binary path to use
        if environment == "production" and chrome_bin_path:
            chrome_options.binary_location = chrome_bin_path
            browser_path = chrome_bin_path
        else:
            chrome_options.binary_location = chrome_path
            browser_path = chrome_path

        # ✅ Instantiate webdriver only ONCE
        self.webdriver = uc.Chrome(
            options=chrome_options,
            browser_executable_path=browser_path,
            use_subprocess=True
        )

        print("🌍 ENV:", environment)
        print("🔥 Headless mode:", HEADLESS_MODE)
        print("🧠 Chromium binary at:", chrome_options.binary_location)


    def open_instagram(self):
        try:
            self.webdriver.get("https://www.instagram.com/")
            self.webdriver.delete_all_cookies()
            for cookie in self.cookies:
                cookie.pop("sameSite", None)
                cookie.pop("hostOnly", None)
                cookie["domain"] = ".instagram.com"
                self.webdriver.add_cookie(cookie)
            self.webdriver.get(self.profile_url)
            time.sleep(5)
        except Exception as e:
            print(f"❌ open_instagram failed: {e}")
            raise e

    def go_to_following(self):
        try:
            print("🔍 Finding Following button...")
            following_button = WebDriverWait(self.webdriver, 10).until(
                EC.element_to_be_clickable((By.XPATH, "//a[contains(@href, '/following/')]"))
            )
            following_button.click()
            time.sleep(5)
        except Exception as e:
            print(f"⚠️ Error clicking Following button: {str(e)}")
            self.webdriver.quit()
            raise e

    def load_existing_following(self):
        print("📥 Loading existing following from Firestore...")
        collection_ref = db.collection("users").document(str(self.user)).collection("followings")
        docs = collection_ref.stream()
        self.existing_following = {
            doc.to_dict().get("username"): doc.id for doc in docs if doc.to_dict().get("username")
        }

    def scroll_and_extract(self):
        try:
            print("📜 Scrolling and extracting following...", flush=True)
            scroll_box = WebDriverWait(self.webdriver, 10).until(
                EC.presence_of_element_located((By.CLASS_NAME, "xyi19xy"))
            )
            last_height = self.webdriver.execute_script("return arguments[0].scrollHeight", scroll_box)
            seen_usernames = set()
            scroll_attempts = 0

            while True:
                time.sleep(2)
                user_blocks = scroll_box.find_elements(
                    By.XPATH,
                    ".//div[contains(@class, 'x1yztbdb') or contains(@class, 'x1qjc9v5')]"
                )
                current_chunk = set()

                for block in user_blocks:
                    try:
                        username_elem = block.find_element(
                            By.XPATH, ".//span[@class='_ap3a _aaco _aacw _aacx _aad7 _aade']"
                        )
                        button_elem = block.find_element(
                            By.XPATH, ".//div[text()='Following']"
                        )

                        if username_elem and button_elem:
                            username = username_elem.text.strip()
                            if username and username not in seen_usernames:
                                current_chunk.add(username)
                                seen_usernames.add(username)
                                self.seen_usernames_all.add(username)
                    except (StaleElementReferenceException, NoSuchElementException):
                        continue

                if current_chunk:
                    self.process_chunk(current_chunk)

                self.webdriver.execute_script("arguments[0].scrollTop = arguments[0].scrollHeight", scroll_box)
                time.sleep(2)

                new_height = self.webdriver.execute_script("return arguments[0].scrollHeight", scroll_box)
                if new_height == last_height:
                    scroll_attempts += 1
                    if scroll_attempts > 2:
                        print("⏹️ Reached end of scroll.", flush=True)
                        break
                else:
                    scroll_attempts = 0
                    last_height = new_height

            return True

        except Exception as e:
            print(f"❌ Error in scroll_and_extract: {e}", flush=True)
            raise e


    def process_chunk(self, chunk):
        collection_ref = db.collection("users").document(str(self.user)).collection("followings")
        new_users = chunk - set(self.existing_following.keys())
        if not new_users:
            return

        print(f"📦 Saving {len(new_users)} new following...", flush=True)
        batch = db.batch()
        for username in new_users:
            doc_ref = collection_ref.document()
            batch.set(doc_ref, {"username": username})
            print(f"✅ Queued to add: {username}", flush=True)
            self.existing_following[username] = doc_ref.id
        batch.commit()
        print("📬 Chunk committed to Firestore.", flush=True)


    def save_removed_users_to_db(self):
        collection_ref = db.collection("users").document(str(self.user)).collection("followings")
        to_remove = set(self.existing_following.keys()) - self.seen_usernames_all
        if not to_remove:
            print("✅ No following to remove.", flush=True)
            return

        print(f"➖ To Remove: {to_remove}", flush=True)
        batch = db.batch()
        for username in to_remove:
            doc_id = self.existing_following.get(username)
            if doc_id:
                doc_ref = collection_ref.document(doc_id)
                batch.delete(doc_ref)
                print(f"❌ Queued to remove: {username}", flush=True)
        batch.commit()
        print("🎯 Removed unfollowed users from Firestore.", flush=True)


    def run(self):
        try:
            self.open_instagram()
            self.go_to_following()
            self.load_existing_following()

            scroll_success = self.scroll_and_extract()
            if scroll_success:
                self.save_removed_users_to_db()
                self.success = True
                print("🎉 Following extraction and sync complete.")
            else:
                print("❌ Scrolling failed — aborting save.")
                self.success = False

        except Exception as e:
            print(f"❌ Bot failed during run(): {str(e)}")
            self.success = False
            raise

        finally:
            try:
                self.webdriver.quit()
            except Exception as e:
                print(f"⚠️ Failed to quit webdriver: {e}")


class Command(BaseCommand):
    help = "Extract following and save them in Firestore"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=str)

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        bot = InstagramFollowing(user=user_id)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"✅ Successfully saved following for user {user_id}"))
        else:
            self.stdout.write(self.style.ERROR(f"❌ No data extracted for user {user_id}"))
