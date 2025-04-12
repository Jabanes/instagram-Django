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


class InstagramUnfollower:
    def __init__(self, user=None, cookies=None, profile_url=None, time_sleep=5):
        self.user = user
        self.cookies = cookies or []
        self.profile_url = profile_url
        self.success = False
        self.unfollowed = []
        self.time_sleep = time_sleep

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

    def run(self):
        session = self.build_session()
        usernames = [n["username"] for n in NonFollowerStore.list(self.user)]

        if not usernames:
            print("⚠️ No users in unfollow list.")
            return

        for username in usernames:
            try:
                user_id = self.get_user_id(session, username)
                self.wait()

                if self.unfollow_user(session, user_id, username):
                    NonFollowerStore.delete(self.user, username)
                    FollowingStore.delete(self.user, username)
                    self.unfollowed.append(username)
                else:
                    print(f"⚠️ Skipped {username} due to unfollow failure.\n")
            except Exception as e:
                print(f"❌ Error processing {username}: {e}\n")
                continue

        if self.unfollowed:
            self.success = True
            print(f"🎯 Finished unfollowing {len(self.unfollowed)} users.")
        else:
            print("📭 No users were unfollowed.")


class Command(BaseCommand):
    help = "Unfollow non-followers via requests"

    def add_arguments(self, parser):
        parser.add_argument("user_id", type=str)

    def handle(self, *args, **kwargs):
        user_id = kwargs["user_id"]
        bot = InstagramUnfollower(user=user_id)
        bot.run()

        if bot.success:
            self.stdout.write(self.style.SUCCESS(f"✅ Successfully unfollowed users for {user_id}"))
        else:
            self.stdout.write(self.style.WARNING(f"⚠️ No users were unfollowed for {user_id}"))
