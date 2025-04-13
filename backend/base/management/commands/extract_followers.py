from django.core.management.base import BaseCommand
from base.firebase import db
import requests
import json
from urllib.parse import urlparse

BATCH_LIMIT = 500

class InstagramFollowers:
    def __init__(self, time_sleep: int = 10, user=None, cookies=None, profile_url=None) -> None:
        self.time_sleep = time_sleep
        self.user = user
        self.cookies = cookies or []
        self.profile_url = profile_url
        self.existing_followers = set()
        self.existing_docs = {}
        self.success = False

    def extract_username_from_url(self):
        parsed = urlparse(self.profile_url)
        path = parsed.path.strip("/").split("/")
        return path[0] if path else None

    def load_existing_followers(self):
        print("📥 Loading existing followers from Firestore...", flush=True)
        collection_ref = db.collection("users").document(str(self.user)).collection("followers")
        docs = collection_ref.stream()
        for doc in docs:
            data = doc.to_dict()
            username = data.get("username")
            if username:
                self.existing_followers.add(username)
                self.existing_docs[username] = doc.id

    def fetch_followers(self):
        print("🔐 Setting up session with injected cookies", flush=True)
        session = requests.Session()
        for cookie in self.cookies:
            if "name" not in cookie or "value" not in cookie:
                continue
            name = cookie["name"]
            value = cookie["value"]
            domain = cookie.get("domain", ".instagram.com")
            path = cookie.get("path", "/")
            session.cookies.set(name, value, domain=domain, path=path)

        session.headers.update({
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Referer": "https://www.instagram.com/",
            "X-CSRFToken": session.cookies.get("csrftoken", ""),
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest"
        })

        username = self.extract_username_from_url()
        print(f"🔍 Fetching user ID for {username}", flush=True)

        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
        res = session.get(url)

        try:
            data = res.json()
        except Exception as e:
            print("❌ Failed to parse JSON:", e)
            print("🧪 Fallback Text (first 500 chars):", res.text[:500])
            raise

        try:
            user_id = data["data"]["user"]["id"]
        except KeyError:
            raise Exception(f"❌ Could not extract user ID. Full response: {data}")

        followers = set()
        has_next = True
        after = None
        query_hash = "c76146de99bb02f6415203be841dd25a"

        print("📡 Querying followers via GraphQL...", flush=True)
        while has_next:
            variables = {
                "id": user_id,
                "include_reel": True,
                "fetch_mutual": False,
                "first": 50,
            }
            if after:
                variables["after"] = after

            params = {
                "query_hash": query_hash,
                "variables": json.dumps(variables)
            }

            res = session.get("https://www.instagram.com/graphql/query/", params=params)
            if res.status_code != 200:
                raise Exception(f"GraphQL query failed: {res.status_code}")

            try:
                data = res.json()
            except Exception as e:
                raise Exception(f"Failed to parse GraphQL response: {e}\nRaw: {res.text[:300]}")

            edges = data["data"]["user"]["edge_followed_by"]["edges"]
            page_info = data["data"]["user"]["edge_followed_by"]["page_info"]

            for edge in edges:
                username = edge["node"]["username"]
                followers.add(username)
                print(f"➕ {username}", flush=True)

            has_next = page_info["has_next_page"]
            after = page_info["end_cursor"] if has_next else None

        return followers

    def sync_followers(self, fetched_followers):
        to_add = fetched_followers - self.existing_followers
        to_remove = self.existing_followers - fetched_followers

        print(f"🆕 New followers to add: {len(to_add)}")
        print(f"🗑️ Followers to remove: {len(to_remove)}")

        collection_ref = db.collection("users").document(str(self.user)).collection("followers")

        # Batched ADD
        to_add = list(to_add)
        for i in range(0, len(to_add), BATCH_LIMIT):
            batch = db.batch()
            chunk = to_add[i:i + BATCH_LIMIT]
            for username in chunk:
                doc_ref = collection_ref.document()
                batch.set(doc_ref, {"username": username})
            batch.commit()
            print(f"✅ Batch added {len(chunk)} users")

        # Batched REMOVE
        to_remove = list(to_remove)
        for i in range(0, len(to_remove), BATCH_LIMIT):
            batch = db.batch()
            chunk = to_remove[i:i + BATCH_LIMIT]
            for username in chunk:
                doc_id = self.existing_docs.get(username)
                if doc_id:
                    doc_ref = collection_ref.document(doc_id)
                    batch.delete(doc_ref)
            batch.commit()
            print(f"🧹 Batch removed {len(chunk)} users")

    def run(self):
        try:
            self.load_existing_followers()
            fetched = self.fetch_followers()
            self.sync_followers(fetched)
            self.success = True
            print("🎉 Followers extraction and sync complete.", flush=True)
        except Exception as e:
            print(f"❌ Followers bot error: {str(e)}", flush=True)
            self.success = False
            raise


class Command(BaseCommand):
    help = "Extract followers and sync with Firestore"

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=str)
        parser.add_argument('--cookies', type=str, help="Cookies JSON string")
        parser.add_argument('--profile_url', type=str, help="Instagram profile URL")

    def handle(self, *args, **kwargs):
        user_id = kwargs['user_id']
        cookies = json.loads(kwargs.get('cookies') or "[]")
        profile_url = kwargs.get('profile_url') or ""

        bot = InstagramFollowers(user=user_id, cookies=cookies, profile_url=profile_url)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"✅ Successfully synced followers for user {user_id}"))
        else:
            self.stdout.write(self.style.ERROR(f"❌ Failed to sync followers for user {user_id}"))
