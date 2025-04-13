from django.core.management.base import BaseCommand
from base.firebase_stores import NonFollowerStore, FollowingStore
from base.firebase import db
import requests
import json
import os
import random
import time
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()

BATCH_LIMIT = 500


class InstagramUnfollower:
    def __init__(self, user=None, cookies=None, profile_url=None, time_sleep=5):
        self.user = user
        self.cookies = cookies or []
        self.profile_url = profile_url
        self.success = False
        self.unfollowed = []
        self.time_sleep = time_sleep
        self.non_followers = {}  # username -> doc_id
        self.followings = {}     # username -> doc_id

    def wait(self):
        time.sleep(random.uniform(self.time_sleep, self.time_sleep + 2))

    def build_session(self):
        session = requests.Session()
        for cookie in self.cookies:
            if "name" in cookie and "value" in cookie:
                session.cookies.set(cookie["name"], cookie["value"], domain=cookie.get("domain", ".instagram.com"))

        session.headers.update({
            "User-Agent": "Mozilla/5.0",
            "Accept": "*/*",
            "Referer": "https://www.instagram.com/",
            "X-CSRFToken": session.cookies.get("csrftoken", ""),
            "X-IG-App-ID": "936619743392459",
            "X-Requested-With": "XMLHttpRequest"
        })
        return session

    def load_non_followers(self):
        print("📥 Loading non-followers from Firestore...")
        docs = db.collection("users").document(str(self.user)).collection("non_followers").stream()
        for doc in docs:
            data = doc.to_dict()
            username = data.get("username")
            if username:
                self.non_followers[username] = doc.id
        print(f"📊 Loaded {len(self.non_followers)} non-followers")

    def load_followings(self):
        print("📥 Loading followings from Firestore...")
        docs = db.collection("users").document(str(self.user)).collection("followings").stream()
        for doc in docs:
            data = doc.to_dict()
            username = data.get("username")
            if username:
                self.followings[username] = doc.id
        print(f"📊 Loaded {len(self.followings)} followings")

    def get_user_id(self, session, username):
        url = f"https://www.instagram.com/api/v1/users/web_profile_info/?username={username}"
        res = session.get(url)
        if res.status_code != 200:
            raise Exception(f"Failed to fetch user ID for {username} — {res.status_code}")
        return res.json()["data"]["user"]["id"]

    def unfollow_user(self, session, user_id, username):
        url = f"https://www.instagram.com/web/friendships/{user_id}/unfollow/"
        res = session.post(url)
        if res.status_code == 200:
            print(f"✅ Unfollowed {username}")
            return True
        else:
            print(f"❌ Failed to unfollow {username} ({res.status_code}): {res.text}")
            return False

    def batch_delete_usernames(self, usernames, collection_name, id_map):
        if not usernames:
            return

        print(f"🧹 Deleting {len(usernames)} from {collection_name}")
        collection_ref = db.collection("users").document(str(self.user)).collection(collection_name)
        usernames = list(usernames)

        for i in range(0, len(usernames), BATCH_LIMIT):
            batch = db.batch()
            chunk = usernames[i:i + BATCH_LIMIT]
            for username in chunk:
                doc_id = id_map.get(username)
                if doc_id:
                    doc_ref = collection_ref.document(doc_id)
                    batch.delete(doc_ref)
            batch.commit()
            print(f"🗑️ Batch deleted {len(chunk)} from {collection_name}")

    def run(self):
        session = self.build_session()
        self.load_non_followers()
        self.load_followings()

        usernames = list(self.non_followers.keys())
        if not usernames:
            print("⚠️ No users in unfollow list.")
            return

        for username in usernames:
            try:
                user_id = self.get_user_id(session, username)
                self.wait()

                if self.unfollow_user(session, user_id, username):
                    self.unfollowed.append(username)
                else:
                    print(f"⚠️ Skipped {username} due to unfollow failure.\n")
            except Exception as e:
                print(f"❌ Error processing {username}: {e}\n")
                continue

        if self.unfollowed:
            print(f"🎯 Finished unfollowing {len(self.unfollowed)} users.")
            self.batch_delete_usernames(self.unfollowed, "non_followers", self.non_followers)
            self.batch_delete_usernames(self.unfollowed, "followings", self.followings)
            self.success = True
        else:
            print("📭 No users were unfollowed.")


class Command(BaseCommand):
    help = "Unfollow non-followers via requests"

    def add_arguments(self, parser):
        parser.add_argument("user_id", type=str)
        parser.add_argument("--cookies", type=str, help="Cookies JSON string")
        parser.add_argument("--profile_url", type=str, help="Instagram profile URL")

    def handle(self, *args, **kwargs):
        user_id = kwargs["user_id"]
        cookies = json.loads(kwargs.get("cookies") or "[]")
        profile_url = kwargs.get("profile_url") or ""

        bot = InstagramUnfollower(user=user_id, cookies=cookies, profile_url=profile_url)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"✅ Successfully unfollowed users for {user_id}"))
        else:
            self.stdout.write(self.style.WARNING(f"⚠️ No users were unfollowed for {user_id}"))
