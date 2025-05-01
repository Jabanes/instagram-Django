# yourapp/management/commands/sync_instagram_data.py
from django.core.management.base import BaseCommand, CommandError
# --- Firebase/Store Imports ---
from base.firebase import db # Assuming 'db' is your initialized Firestore client
from base.firebase_stores import BotStatusStore # Import the status store
from firebase_admin import firestore # For SERVER_TIMESTAMP
# --- Other necessary imports ---
import json
import threading # Although the view handles threading, keep for context if needed
# --- Imports for the actual bot logic ---

from .extract_followers import InstagramFollowers
from .extract_following import InstagramFollowing



BATCH_LIMIT = 500 # Define batch limit for Firestore operations

class Command(BaseCommand):
    help = "Syncs followers, following, and non-followers efficiently for a given user."

    # --- ***** ADD THIS METHOD ***** ---
    def add_arguments(self, parser):
        """
        Define the command-line arguments this command accepts.
        """
        # Required positional argument for the user ID
        parser.add_argument('user_id', type=str, help="The Firebase UID of the user to sync.")

        # Named arguments for cookies and profile URL (passed from the view)
        # Use '--' prefix for named arguments
        parser.add_argument(
            '--cookies',
            type=str, # Expecting a JSON string
            required=True, # Make required if the command cannot run without them
            help="JSON string containing the user's Instagram cookies."
        )
        parser.add_argument(
            '--profile_url',
            type=str,
            required=True, # Make required
            help="The user's Instagram profile URL."
        )
        # Add any other arguments your command might need

    # --- Helper: Load Collection ---
    def load_collection(self, user_id, collection_name):
        """Loads all documents from a subcollection into a set of usernames and a map."""
        self.stdout.write(f"📥 Loading existing {collection_name} for user {user_id}...")
        docs_set = set()
        docs_map = {} # username -> doc_id
        try:
            collection_ref = db.collection("users").document(user_id).collection(collection_name)
            # Using select(["username"]) can slightly reduce downloaded data size, but read cost is per document.
            docs_stream = collection_ref.select(["username"]).stream()
            count = 0
            for doc in docs_stream:
                data = doc.to_dict()
                username = data.get("username")
                if username:
                    docs_set.add(username)
                    docs_map[username] = doc.id
                    count += 1
            self.stdout.write(f"📊 Loaded {count} existing {collection_name}")
            return docs_set, docs_map
        except Exception as e:
            self.stderr.write(f"❌ Error loading {collection_name}: {e}")
            # Depending on severity, you might want to re-raise or return empty sets/maps
            raise CommandError(f"Failed to load {collection_name} from Firestore.") from e


    # --- Helper: Sync Collection (Add/Remove Diffs) ---
    def sync_collection(self, user_id, collection_name, fetched_set, existing_set, existing_map):
        """Adds/Removes documents in Firestore to match the fetched_set using batches."""
        self.stdout.write(f"🔄 Syncing {collection_name} for user {user_id}...")
        to_add = fetched_set - existing_set
        # Calculate removals based on what's in existing_set but NOT in fetched_set
        to_remove = existing_set - fetched_set

        self.stdout.write(f"  🆕 New {collection_name} to add: {len(to_add)}")
        self.stdout.write(f"  🗑️ {collection_name} to remove: {len(to_remove)}")

        collection_ref = db.collection("users").document(user_id).collection(collection_name)
        total_added = 0
        total_removed = 0

        try:
            # --- Batched ADD ---
            if to_add:
                add_list = list(to_add)
                for i in range(0, len(add_list), BATCH_LIMIT):
                    batch = db.batch()
                    chunk = add_list[i:i + BATCH_LIMIT]
                    for username in chunk:
                        # Decide ID strategy: Auto-ID or username? Using Auto-ID for now.
                        doc_ref = collection_ref.document()
                        batch.set(doc_ref, {"username": username})
                    batch.commit()
                    total_added += len(chunk)
                    self.stdout.write(f"  ➕ Batch ADDED {len(chunk)} {collection_name}")
                self.stdout.write(f"  ✅ Total ADDED {total_added} {collection_name}")

            # --- Batched REMOVE ---
            if to_remove:
                remove_list = list(to_remove)
                for i in range(0, len(remove_list), BATCH_LIMIT):
                    batch = db.batch()
                    chunk = remove_list[i:i + BATCH_LIMIT]
                    removed_in_batch = 0
                    for username in chunk:
                        doc_id = existing_map.get(username)
                        if doc_id:
                            doc_ref = collection_ref.document(doc_id)
                            batch.delete(doc_ref)
                            removed_in_batch += 1
                        else:
                            self.stderr.write(f"  ⚠️ Could not find doc_id for {username} in existing map during removal.")
                    if removed_in_batch > 0:
                        batch.commit()
                        total_removed += removed_in_batch
                        self.stdout.write(f"  ➖ Batch REMOVED {removed_in_batch} {collection_name}")
                self.stdout.write(f"  ✅ Total REMOVED {total_removed} {collection_name}")

            # Return counts for status reporting
            return total_added, total_removed

        except Exception as e:
            self.stderr.write(f"❌ Firestore error during {collection_name} sync: {e}")
            raise CommandError(f"Failed during Firestore sync for {collection_name}.") from e


    # --- Main Command Logic ---
    def handle(self, *args, **kwargs):
        """
        The main execution logic for the sync command.
        """
        user_id = kwargs['user_id']
        cookies_json_str = kwargs['cookies']
        profile_url = kwargs['profile_url']

        self.stdout.write(f"🚀 Starting full data sync for user: {user_id}")

        # Initialize status variables
        final_status = "error" # Default to error
        final_message = "Sync process did not complete."
        followers_added, followers_removed = 0, 0
        following_added, following_removed = 0, 0
        nf_added, nf_removed = 0, 0

        try:
            # --- Validate and Parse Cookies ---
            try:
                cookies = json.loads(cookies_json_str)
                if not isinstance(cookies, list):
                    raise ValueError("Cookies JSON must be a list.")
            except (json.JSONDecodeError, ValueError) as e:
                raise CommandError(f"Invalid cookies JSON provided: {e}")

            # --- Followers Sync ---
            self.stdout.write("\n--- Syncing Followers ---")
            followers_bot = InstagramFollowers(user=user_id, cookies=cookies, profile_url=profile_url)
            existing_followers_set, existing_followers_map = self.load_collection(user_id, "followers")
            fetched_followers_set = followers_bot.fetch_followers() # This method should exist in your class
            followers_added, followers_removed = self.sync_collection(
                user_id, "followers", fetched_followers_set, existing_followers_set, existing_followers_map
            )

            # --- Following Sync ---
            self.stdout.write("\n--- Syncing Following ---")
            following_bot = InstagramFollowing(user=user_id, cookies=cookies, profile_url=profile_url)
            existing_following_set, existing_following_map = self.load_collection(user_id, "followings")
            fetched_following_set = following_bot.fetch_following() # This method should exist in your class
            following_added, following_removed = self.sync_collection(
                user_id, "followings", fetched_following_set, existing_following_set, existing_following_map
            )

            # --- Non-Followers Sync ---
            self.stdout.write("\n--- Syncing Non-Followers ---")
            target_non_followers_set = fetched_following_set - fetched_followers_set
            existing_nf_set, existing_nf_map = self.load_collection(user_id, "non_followers")
            nf_added, nf_removed = self.sync_collection(
                user_id, "non_followers", target_non_followers_set, existing_nf_set, existing_nf_map
            )

            # --- Determine Final Status ---
            total_changes = followers_added + followers_removed + following_added + following_removed + nf_added + nf_removed
            if total_changes > 0:
                final_status = "success"
                final_message = (
                    f"Sync complete. Followers: +{followers_added}/-{followers_removed}. "
                    f"Following: +{following_added}/-{following_removed}. "
                    f"NonFollowers: +{nf_added}/-{nf_removed}."
                )
            else:
                final_status = "no_change"
                final_message = "Sync complete. No changes detected in followers, following, or non-followers."

            self.stdout.write(self.style.SUCCESS(f"\n✅ Successfully completed sync for user {user_id}"))
            self.stdout.write(f"   Summary: {final_message}")

        except CommandError as e: # Catch errors raised explicitly within the command
            self.stderr.write(self.style.ERROR(f"❌ Command Error during sync for {user_id}: {e}"))
            final_status = "error"
            final_message = f"Command Error: {e}"
            # No need to raise again, we'll update status in finally

        except Exception as e: # Catch unexpected errors
            self.stderr.write(self.style.ERROR(f"❌ Unexpected Error during sync for {user_id}: {e}"))
            # Optionally log the full traceback here
            import traceback
            traceback.print_exc()
            final_status = "error"
            final_message = f"Unexpected Error: {e}"
            # No need to raise again

        finally:
            # --- Update Bot Status in Firestore ---
            # This ensures status is updated even if errors occur
            self.stdout.write(f"\n🏁 Updating final bot status ({final_status}) for user {user_id}...")
            try:
                # Prepare status data - include counts if needed by frontend/popup
                status_data = {
                    "type": "sync_all",
                    "status": final_status,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": final_message,
                    # Optionally add counts if useful for display
                    # "followers_added": followers_added,
                    # "followers_removed": followers_removed,
                    # etc.
                }
                # Use set_status which should handle setting is_running to False internally
                # Or call set_running(False) separately if needed by your store logic
                BotStatusStore.set_status(user_id, status_data)
                # Ensure is_running is explicitly false if set_status doesn't handle it
                # BotStatusStore.set_running(user_id, False)
                self.stdout.write(self.style.SUCCESS(f"   Final status updated successfully."))
            except Exception as db_err:
                self.stderr.write(self.style.ERROR(f"   ❌❌ Failed to update final bot status for user {user_id}: {db_err}"))

            self.stdout.write(f"--- Sync process finished for user {user_id} ---")
