# yourapp/management/commands/unfollow.py

from django.core.management.base import BaseCommand, CommandError
# Firebase Store Imports (adjust path if needed)
from base.firebase_stores import BotStatusStore
from base.firebase import db
from firebase_admin import firestore # For SERVER_TIMESTAMP
# Standard Imports
import requests
import json
import os
import random
import time
import traceback
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables if used
# load_dotenv()

BATCH_LIMIT = 500 # Firestore batch limit
FIRESTORE_IN_QUERY_LIMIT = 30 # Firestore 'in' query limit

class InstagramUnfollower:
    """
    Handles the process of unfollowing users listed in the 'non_followers'
    collection and updating Firestore accordingly using optimized reads.
    """
    def __init__(self, user=None, cookies=None, profile_url=None, time_sleep=5):
        if not user or not cookies or not profile_url:
            raise ValueError("User ID, cookies, and profile URL are required.")

        self.user_id = str(user)
        self.cookies = cookies
        self.profile_url = profile_url
        self.time_sleep = max(1, time_sleep)
        self.success = False
        self.unfollowed_usernames = [] # Usernames successfully unfollowed on INSTAGRAM
        self.non_followers_map = {}  # username -> doc_id (from non_followers collection)

    def wait(self):
        """Adds a randomized delay between actions."""
        delay = random.uniform(self.time_sleep, self.time_sleep + 2)
        print(f"  ...waiting {delay:.2f} seconds...")
        time.sleep(delay)

    def build_session(self):
        """Builds a requests session with necessary headers and cookies."""
        print("🔧 Building requests session...")
        session = requests.Session()
        csrf_token = None
        try:
            for cookie in self.cookies:
                if isinstance(cookie, dict) and "name" in cookie and "value" in cookie:
                    if cookie["name"] == "csrftoken": csrf_token = cookie["value"]
                    session.cookies.set(
                        cookie["name"], cookie["value"],
                        domain=cookie.get("domain", ".instagram.com"),
                        path=cookie.get("path", "/")
                    )
                else: print(f"  ⚠️ Skipping invalid cookie format: {cookie}")

            if not csrf_token:
                 csrf_token = session.cookies.get("csrftoken", "")
                 if not csrf_token: print("  ⚠️ WARNING: CSRF token not found in cookies.")

            # Use headers similar to the working script
            session.headers.update({
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                "Referer": "https://www.instagram.com/",
                "X-CSRFToken": csrf_token or "",
                "X-IG-App-ID": "936619743392459", # Web app ID
                "X-Requested-With": "XMLHttpRequest",
                "Origin": "https://www.instagram.com",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
            })
            print("✅ Session built successfully.")
            return session
        except Exception as e:
            print(f"❌ Error building session: {e}")
            raise CommandError("Failed to build requests session.") from e

    def load_non_followers(self):
        """Loads the non_followers list from Firestore into a map."""
        print(f"📥 Loading non-followers for user {self.user_id} from Firestore...")
        self.non_followers_map = {}
        try:
            collection_ref = db.collection("users").document(self.user_id).collection("non_followers")
            docs_stream = collection_ref.select(["username"]).stream()
            count = 0
            for doc in docs_stream:
                data = doc.to_dict()
                if data:
                    username = data.get("username")
                    if username:
                        self.non_followers_map[username] = doc.id
                        count += 1
                    else: print(f"  ⚠️ Document {doc.id} missing 'username'.")
                else: print(f"  ⚠️ Document {doc.id} has no data.")
            print(f"📊 Loaded {count} non-followers to potentially unfollow.")
            if count == 0: print("  ✅ No non-followers found in the list.")
        except Exception as e:
            print(f"❌ Error loading non-followers: {e}")
            traceback.print_exc()
            raise CommandError("Failed to load non-followers list from Firestore.") from e

    def get_instagram_user_id(self, session, username):
        """Fetches the Instagram numerical ID for a given username."""
        print(f"  🔍 Fetching Instagram ID for '{username}'...")
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
        try:
            res = session.get(url, timeout=10)
            res.raise_for_status()
            data = res.json()
            user_id = data.get("data", {}).get("user", {}).get("id")
            if not user_id: raise ValueError(f"Could not extract user ID for {username}")
            print(f"  ✅ Found ID: {user_id} for '{username}'")
            return user_id
        except requests.exceptions.RequestException as e: print(f"  ❌ Network error fetching ID for {username}: {e}"); return None
        except (ValueError, KeyError, json.JSONDecodeError) as e: print(f"  ❌ Error parsing/finding ID for {username}: {e}"); return None

    def unfollow_user_on_instagram(self, session, instagram_user_id, username):
        """Sends the unfollow request to Instagram's Web API."""
        print(f"  📤 Attempting to unfollow '{username}' (ID: {instagram_user_id})...")
        # *** Use the endpoint from the previously working script ***
        url = f"https://www.instagram.com/web/friendships/{instagram_user_id}/unfollow/"
        try:
            # This endpoint typically requires a POST request
            res = session.post(url, timeout=10)

            # Check for successful status code (usually 200 OK)
            if res.status_code == 200:
                 # Sometimes the response body might be JSON, sometimes not
                 try:
                     response_data = res.json()
                     # Check for specific success status if available in JSON
                     if response_data.get("status") == "ok":
                         print(f"  ✅ Successfully unfollowed '{username}' via Web API (JSON status ok).")
                         return True
                     else:
                         # Got 200 OK but JSON status wasn't 'ok'
                         print(f"  ⚠️ Unfollow API call for '{username}' returned 200 OK but status: {response_data.get('status')}. Assuming success based on status code.")
                         return True # Treat 200 OK as success even if JSON status is weird
                 except json.JSONDecodeError:
                     # Got 200 OK but response wasn't JSON, assume success
                     print(f"  ✅ Successfully unfollowed '{username}' via Web API (Received 200 OK, non-JSON response).")
                     return True
            else:
                # Request failed (e.g., 400, 403, 404, 500)
                print(f"  ❌ Failed to unfollow '{username}'. Status: {res.status_code}. Response: {res.text[:300]}")
                return False
        except requests.exceptions.RequestException as e:
            print(f"  ❌ Network error during unfollow for {username}: {e}")
            return False
        except Exception as e:
             print(f"  ❌ Unexpected error during unfollow attempt for {username}: {e}")
             traceback.print_exc()
             return False


    def batch_delete_from_collection(self, collection_name, doc_id_list):
        """Performs batched deletes on a given collection using document IDs."""
        if not doc_id_list: print(f"  ℹ️ No documents to delete from '{collection_name}'."); return 0
        print(f"🧹 Deleting {len(doc_id_list)} documents from '{collection_name}'...")
        collection_ref = db.collection("users").document(self.user_id).collection(collection_name)
        total_deleted = 0
        try:
            for i in range(0, len(doc_id_list), BATCH_LIMIT):
                batch = db.batch()
                chunk = doc_id_list[i:i + BATCH_LIMIT]
                deleted_in_batch = 0
                for doc_id in chunk:
                    if doc_id: doc_ref = collection_ref.document(doc_id); batch.delete(doc_ref); deleted_in_batch += 1
                if deleted_in_batch > 0: batch.commit(); total_deleted += deleted_in_batch; print(f"  🗑️ Batch deleted {deleted_in_batch} from '{collection_name}'")
            print(f"  ✅ Total deleted {total_deleted} from '{collection_name}'.")
            return total_deleted
        except Exception as e: print(f"❌ Firestore error during batch delete for '{collection_name}': {e}"); traceback.print_exc(); return total_deleted

    def query_and_delete_followings(self, usernames_to_delete):
        """Queries the 'followings' collection for specific usernames and deletes them."""
        if not usernames_to_delete: print("  ℹ️ No usernames provided to query/delete from 'followings'."); return 0
        print(f"🔍 Querying and deleting {len(usernames_to_delete)} users from 'followings' collection...")
        collection_ref = db.collection("users").document(self.user_id).collection("followings")
        doc_ids_to_delete = []
        try:
            username_chunks = [usernames_to_delete[i:i + FIRESTORE_IN_QUERY_LIMIT] for i in range(0, len(usernames_to_delete), FIRESTORE_IN_QUERY_LIMIT)]
            print(f"   querying 'followings' in {len(username_chunks)} chunk(s)...")
            for chunk in username_chunks:
                if not chunk: continue
                query = collection_ref.where("username", "in", chunk)
                docs_stream = query.stream()
                found_in_chunk = 0
                for doc in docs_stream: doc_ids_to_delete.append(doc.id); found_in_chunk += 1
                print(f"  chunk processed ({len(chunk)} usernames), found {found_in_chunk} matching documents.")
            # Perform batched deletes using the collected IDs
            return self.batch_delete_from_collection("followings", doc_ids_to_delete)
        except Exception as e: print(f"❌ Error querying or preparing deletes for 'followings': {e}"); traceback.print_exc(); return 0

    def run(self):
        """Executes the unfollow process."""
        print(f"\n--- Starting Unfollow Process for User: {self.user_id} ---")
        self.success = False; self.unfollowed_usernames = []
        try:
            self.load_non_followers()
            non_follower_usernames = list(self.non_followers_map.keys())
            if not non_follower_usernames: print("✅ No users found in the non-followers list."); self.success = True; return
            session = self.build_session()
            print(f"\n▶️ Processing {len(non_follower_usernames)} users for unfollow...")
            for i, username in enumerate(non_follower_usernames, 1):
                print(f"\n[{i}/{len(non_follower_usernames)}] Processing '{username}'...")
                instagram_user_id = self.get_instagram_user_id(session, username)
                if not instagram_user_id: print(f"  ⚠️ Skipping '{username}' - Could not retrieve Instagram User ID."); continue
                self.wait()
                if self.unfollow_user_on_instagram(session, instagram_user_id, username):
                    self.unfollowed_usernames.append(username)
                else: print(f"  ⚠️ Failed to unfollow '{username}' on Instagram. Will not remove from Firestore lists.")
            print(f"\n--- Firestore Cleanup ---")
            if self.unfollowed_usernames:
                print(f"🎯 Successfully unfollowed {len(self.unfollowed_usernames)} users on Instagram.")
                non_follower_doc_ids = [self.non_followers_map.get(uname) for uname in self.unfollowed_usernames if self.non_followers_map.get(uname)]
                self.batch_delete_from_collection("non_followers", non_follower_doc_ids)
                self.query_and_delete_followings(self.unfollowed_usernames)
                self.success = True
            else: print("📭 No users were successfully unfollowed on Instagram during this run."); self.success = True
        except CommandError as e: print(f"❌ Command Error during unfollow process: {e}"); self.success = False
        except Exception as e: print(f"❌❌ Unexpected Error during unfollow process: {e}"); traceback.print_exc(); self.success = False
        finally: print(f"\n--- Unfollow Process Finished for User: {self.user_id}. Success: {self.success} ---")


# --- Django Management Command ---
class Command(BaseCommand):
    help = "Unfollows users listed in the 'non_followers' collection for a given user."
    def add_arguments(self, parser):
        parser.add_argument("user_id", type=str, help="Firebase UID of the user.")
        parser.add_argument("--cookies", type=str, required=True, help="Cookies JSON string.")
        parser.add_argument("--profile_url", type=str, required=True, help="Instagram profile URL.")
        parser.add_argument("--sleep", type=int, default=5, help="Base sleep time between actions (seconds).")

    def handle(self, *args, **kwargs):
        user_id = kwargs["user_id"]; cookies_json = kwargs["cookies"]; profile_url = kwargs["profile_url"]; sleep_time = kwargs["sleep"]
        final_status = "error"; final_message = "Unfollow process did not complete."; unfollowed_count = 0; bot = None # Initialize bot
        try:
            try: cookies = json.loads(cookies_json); assert isinstance(cookies, list)
            except (json.JSONDecodeError, ValueError, AssertionError) as e: raise CommandError(f"Invalid cookies JSON provided: {e}")
            self.stdout.write(f"🚀 Initializing unfollow bot for user {user_id}...")
            bot = InstagramUnfollower(user=user_id, cookies=cookies, profile_url=profile_url, time_sleep=sleep_time)
            bot.run()
            unfollowed_count = len(bot.unfollowed_usernames)
            if bot.success:
                final_status = "success" if unfollowed_count > 0 else "no_change"
                final_message = f"Successfully unfollowed {unfollowed_count} users." if unfollowed_count > 0 else "Process completed, no users were unfollowed."
                self.stdout.write(self.style.SUCCESS(f"✅ Unfollow process completed for {user_id}. {final_message}"))
            else: final_status = "error"; final_message = "Unfollow process failed. Check logs."; self.stderr.write(self.style.ERROR(f"❌ Unfollow process failed for {user_id}."))
        except CommandError as e: self.stderr.write(self.style.ERROR(f"❌ Command Error: {e}")); final_status = "error"; final_message = f"Command Error: {e}"
        except Exception as e: self.stderr.write(self.style.ERROR(f"❌ Unexpected Error: {e}")); traceback.print_exc(); final_status = "error"; final_message = f"Unexpected Error: {e}"
        finally:
            self.stdout.write(f"🏁 Updating final bot status ({final_status}) for unfollow...")
            try:
                status_data = {"type": "unfollow", "status": final_status, "timestamp": firestore.SERVER_TIMESTAMP, "message": final_message, "unfollowed_count": unfollowed_count if bot and bot.success else None }
                status_data_cleaned = {k: v for k, v in status_data.items() if v is not None}
                BotStatusStore.set_status(user_id, status_data_cleaned)
                self.stdout.write(self.style.SUCCESS(f"   Final unfollow status updated."))
            except Exception as db_err: self.stderr.write(self.style.ERROR(f"   ❌❌ Failed to update final unfollow status: {db_err}"))

