# sync_instagram_data.py (Conceptual Sketch)
from django.core.management.base import BaseCommand
from base.firebase import db
import json
# Assuming InstagramFollowers/Following classes exist and can fetch data
from .extract_followers import InstagramFollowers # Or however you import
from .extract_following import InstagramFollowing # Or however you import

BATCH_LIMIT = 500

class Command(BaseCommand):
    help = "Syncs followers, following, and non-followers efficiently"

    # --- Add arguments parser ---

    def load_collection(self, user_id, collection_name):
        # (Same as provided in previous thought block - reads collection once)
        print(f"📥 Loading existing {collection_name} from Firestore...")
        docs_set = set()
        docs_map = {} # username -> doc_id
        collection_ref = db.collection("users").document(user_id).collection(collection_name)
        # .select(["username"]) can slightly reduce data transfer, not read count
        docs = collection_ref.select(["username"]).stream()
        for doc in docs:
            data = doc.to_dict()
            username = data.get("username")
            if username:
                docs_set.add(username)
                docs_map[username] = doc.id
        print(f"📊 Loaded {len(docs_set)} existing {collection_name}")
        return docs_set, docs_map

    def sync_collection(self, user_id, collection_name, fetched_set, existing_set, existing_map):
        # (Same as provided in previous thought block - syncs only diffs)
        print(f"🔄 Syncing {collection_name}...")
        to_add = fetched_set - existing_set
        to_remove = existing_set - existing_map.keys() # Use map keys here for accuracy with map

        # Ensure fetched users exist in the map for removal logic if needed later
        # Or better: calculate remove based on existing_set vs fetched_set
        to_remove_final = existing_set - fetched_set

        print(f"  🆕 New {collection_name} to add: {len(to_add)}")
        print(f"  🗑️ {collection_name} to remove: {len(to_remove_final)}") # Corrected print

        collection_ref = db.collection("users").document(user_id).collection(collection_name)

        # Batched ADD (only if to_add is not empty)
        if to_add:
            # ... (batch add logic) ...
            print(f"  ✅ Batch ADDED {len(to_add)} {collection_name}")


        # Batched REMOVE (only if to_remove_final is not empty)
        if to_remove_final:
             # ... (batch remove logic using existing_map to get IDs for usernames in to_remove_final) ...
             print(f"  🧹 Batch REMOVED {len(to_remove_final)} {collection_name}")


    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        cookies = json.loads(kwargs.get('cookies') or "[]")
        profile_url = kwargs.get('profile_url') or ""

        try:
            # --- Followers ---
            followers_bot = InstagramFollowers(user=user_id, cookies=cookies, profile_url=profile_url)
            # 1. Load existing followers (N_fl reads)
            existing_followers_set, existing_followers_map = self.load_collection(user_id, "followers")
            # 2. Fetch latest followers from IG
            fetched_followers_set = followers_bot.fetch_followers() # Assumes this method exists
            # 3. Sync only differences
            self.sync_collection(user_id, "followers", fetched_followers_set, existing_followers_set, existing_followers_map)

            # --- Following ---
            following_bot = InstagramFollowing(user=user_id, cookies=cookies, profile_url=profile_url)
            # 4. Load existing following (N_f reads)
            existing_following_set, existing_following_map = self.load_collection(user_id, "followings")
            # 5. Fetch latest following from IG
            fetched_following_set = following_bot.fetch_following() # Assumes this method exists
            # 6. Sync only differences
            self.sync_collection(user_id, "followings", fetched_following_set, existing_following_set, existing_following_map)

            # --- Non-Followers ---
            print("🧮 Calculating and syncing non-followers...")
            # 7. Calculate target non-followers (using in-memory data)
            target_non_followers_set = fetched_following_set - fetched_followers_set
            # 8. Load existing non-followers (N_nf reads)
            existing_nf_set, existing_nf_map = self.load_collection(user_id, "non_followers")
            # 9. Sync only differences (using the generic sync function)
            self.sync_collection(user_id, "non_followers", target_non_followers_set, existing_nf_set, existing_nf_map)

            # --- (Optional) Cache non-follower list for unfollow script ---
            # self.cache_non_followers(user_id, target_non_followers_set, existing_nf_map) # Needs implementation

            self.stdout.write(self.style.SUCCESS(f"✅ Successfully synced all data for user {user_id}"))

        except Exception as e:
            # ... error handling ...
            raise

    # (Optional) def cache_non_followers(self, user_id, final_nf_set, nf_id_map):
    #    cache_data = {uname: nf_id_map[uname] for uname in final_nf_set if uname in nf_id_map}
    #    cache_doc_ref = db.collection("users").document(user_id).collection("state").document("non_followers_cache")
    #    cache_doc_ref.set({"non_followers_map": cache_data}) # 1 write
    #    print("💾 Cached non-follower list with IDs")