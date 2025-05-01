from .firebase import db
from firebase_admin import firestore
from datetime import datetime
from typing import Optional

class UserStore:
    @staticmethod
    def create(uid, email, username, full_name=""):
        user_ref = db.collection("users").document(uid)

        if user_ref.get().exists:
            return  # Already exists

        user_ref.set({
            "email": email,
            "username": username,
            "full_name": full_name,
            "joined_at": firestore.SERVER_TIMESTAMP,
            "scan_info": {
                "last_followers_scan": None,
                "last_following_scan": None
            },
            "role": "standard"
        })

        # Init empty subcollections
        for sub in ["followers", "following", "non_followers"]:
            sub_ref = user_ref.collection(sub).document("placeholder")
            sub_ref.set({"temp": True})
            sub_ref.delete()


class FollowerStore:
    @staticmethod
    def add(user_id, username):
        doc_ref = db.collection("users").document(str(user_id)).collection("followers").document(username)
        doc_ref.set({
            "username": username,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

    @staticmethod
    def list(user_id):
        docs = db.collection("users").document(str(user_id)).collection("followers").stream()
        return [
            {**doc.to_dict(), "id": doc.id}  # Include Firestore doc ID
            for doc in docs
        ]

    @staticmethod
    def clear(user_id):
        followers_ref = db.collection("users").document(str(user_id)).collection("followers").stream()
        for doc in followers_ref:
            doc.reference.delete()
    
    @staticmethod
    def delete(user_id, username):
        collection = db.collection("users").document(str(user_id)).collection("followers")
        for doc in collection.stream():
            if doc.to_dict().get("username") == username:
                doc.reference.delete()
                break

    


class FollowingStore:
    @staticmethod
    def add(user_id, username):
        doc_ref = db.collection("users").document(str(user_id)).collection("followings").document(username)
        doc_ref.set({
            "username": username,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

    @staticmethod
    def list(user_id):
        docs = db.collection("users").document(str(user_id)).collection("followings").stream()
        return [
            {**doc.to_dict(), "id": doc.id}
            for doc in docs
        ]

    @staticmethod
    def clear(user_id):
        followings_ref = db.collection("users").document(str(user_id)).collection("followings").stream()
        for doc in followings_ref:
            doc.reference.delete()

    @staticmethod
    def delete(user_id, username):
        collection = db.collection("users").document(str(user_id)).collection("followings")
        docs = collection.stream()
        for doc in docs:
            if doc.to_dict().get("username") == username:
                doc.reference.delete()
                print(f"🗑️ Removed {username} from Following list.")

class NonFollowerStore:
    @staticmethod
    def add(user_id, username):
        doc_ref = db.collection("users").document(str(user_id)).collection("non_followers").document(username)
        doc_ref.set({
            "username": username,
            "timestamp": firestore.SERVER_TIMESTAMP
        })

    @staticmethod
    def list(user_id):
        docs = db.collection("users").document(str(user_id)).collection("non_followers").stream()
        return [
            {**doc.to_dict(), "id": doc.id}  # Include Firestore doc ID
            for doc in docs
        ]

    @staticmethod
    def clear(user_id):
        nonfollowers_ref = db.collection("users").document(str(user_id)).collection("non_followers").stream()
        for doc in nonfollowers_ref:
            doc.reference.delete()
    
    @staticmethod
    def delete(user_id, username):
        collection = db.collection("users").document(str(user_id)).collection("non_followers")
        docs = collection.stream()
        for doc in docs:
            if doc.to_dict().get("username") == username:
                doc.reference.delete()
                print(f"🗑️ Removed {username} from Non-Followers list.")


class UserScanInfoStore:
    @staticmethod
    def update(user_id, last_following_scan=None, last_followers_scan=None):
        data = {}
        if last_following_scan:
            data["last_following_scan"] = last_following_scan
        if last_followers_scan:
            data["last_followers_scan"] = last_followers_scan

        db.collection("users").document(str(user_id)).set({
            "scan_info": data
        }, merge=True)

    @staticmethod
    def get(user_id):
        doc = db.collection("users").document(str(user_id)).get()
        if doc.exists:
            return doc.to_dict().get("scan_info", {})
        return {}

class BotStatusStore:
    @staticmethod
    def set_running(user_id, is_running, bot_type=None):
        try:
            doc_ref = db.collection("users").document(str(user_id)).collection("status").document("bot")
            print(f"Attempting to set status for path: {doc_ref.path}") # Log path
            data_to_set = {"is_running": is_running}
            if bot_type:
                data_to_set["type"] = bot_type # Add type if provided
            # Use update to avoid overwriting other fields, or set with merge=True
            doc_ref.set(data_to_set, merge=True)
            print(f"Successfully set is_running={is_running} for user {user_id}")
        except Exception as e:
            print(f"!!! Firestore error in set_running for user {user_id}: {e}") # Log specific error
            raise # Re-raise the exception so the view knows it failed

    @staticmethod
    def get_status(user_id: str) -> Optional[bool]:
        status_ref = db.collection("users").document(user_id).collection("status").document("bot")
        doc = status_ref.get()
        return doc.to_dict().get("is_running") if doc.exists else False

    @staticmethod
    def set_status(user_id, status_data: dict):
        db.collection("users").document(user_id).collection("status").document("bot").set(
            status_data,
            merge=True
        )