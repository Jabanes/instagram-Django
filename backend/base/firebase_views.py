from rest_framework.response import Response
from rest_framework.decorators import api_view
from rest_framework import status
import subprocess
import os
import tempfile
from .management.commands.extract_followers import InstagramFollowers
from .management.commands.extract_following import InstagramFollowing
from .management.commands.unfollow import InstagramUnfollower
from base.firebase_stores import NonFollowerStore, FollowerStore, FollowingStore, UserScanInfoStore, UserStore, BotStatusStore
from base.firebase import db
from firebase_admin import auth as firebase_auth, firestore
from django.utils.timezone import now
from threading import Thread
from django.core.management import call_command
from socket import error as SocketError
import errno
import threading
import json
from threading import Thread, BoundedSemaphore 
import jwt
import traceback


MAX_CONCURRENT_BOTS = 3
bot_semaphore = BoundedSemaphore(MAX_CONCURRENT_BOTS)

@api_view(['POST'])
def login(request):
    """
    Verifies Firebase ID token and returns basic user info.
    """
    id_token = request.data.get("idToken")
    if not id_token:
        return Response({"error": "Missing Firebase ID token"}, status=400)

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email')

        return Response({"uid": uid, "email": email})
    except Exception as e:
        return Response({"error": str(e)}, status=401)


@api_view(['POST'])
def signUp(request):
    id_token = request.data.get("idToken")
    if not id_token:
        return Response({"error": "Missing Firebase ID token"}, status=400)

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        uid = decoded_token['uid']
        email = decoded_token.get('email')
        name = decoded_token.get('name', "")
        username = email.split("@")[0] if email else uid

        # ✅ Use your abstraction here
        UserStore.create(uid, email, username, name)

        return Response({"status": "success", "uid": uid, "email": email})

    except Exception as e:
        return Response({"error": str(e)}, status=401)

@api_view(["GET"])
def get_non_followers(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)
    """Returns the non-followers list for the authenticated user."""

    non_followers = []
    collection = db.collection("users").document(str(user_id)).collection("non_followers").stream()

    for doc in collection:
        data = doc.to_dict()
        data["id"] = doc.id  # Attach the document ID explicitly
        non_followers.append(data)

    return Response(
        {"non_followers": non_followers},
        status=status.HTTP_200_OK
    )

@api_view(["POST"])
def generateNonFollowersList(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)
    
    try:

        # Run your bot (same as before)
        call_command('compare_nonfollowers', str(user_id))

        # Fetch from Firebase instead of ORM
        non_followers = NonFollowerStore.list(user_id)

        flag_path = os.path.join(tempfile.gettempdir(), f"new_data_flag_user_{user_id}.flag")

        if os.path.exists(flag_path):
            os.remove(flag_path)
            return Response({"status": "Flag reset successfully."})

        return Response(
            {
                "status": "✅ Script executed via subprocess",
                "non_followers": non_followers
            },
            status=status.HTTP_200_OK
        )

    except subprocess.CalledProcessError as e:
        return Response(
            {"error": f"❌ Script execution failed: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(["POST"])
def update_non_followers_list(request):
    auth_header = request.headers.get("Authorization")
    print("🔥 Reached update_non_followers_list")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)

    new_list = request.data.get("list", [])
    if not isinstance(new_list, list):
        return Response({"error": "Invalid non_followers data. Must be a list of usernames."}, status=400)

    print("Received new list:", new_list)
    collection_ref = db.collection("users").document(user_id).collection("non_followers")

    try:
        # Clear existing non-followers
        existing_docs = collection_ref.stream()
        for doc in existing_docs:
            doc.reference.delete()

        # Add the new filtered list
        for username in new_list:
            collection_ref.add({"username": username})

        return Response({"message": f"✅ Synced non-follower list with {len(new_list)} entries."})
    except Exception as e:
        return Response({"error": str(e)}, status=500)

@api_view(['GET'])
def get_user_follow_stats(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)
        
    followers = FollowerStore.list(user_id)
    followings = FollowingStore.list(user_id)
    scan_info = UserScanInfoStore.get(user_id)

    return Response({
        "followers": len(followers),
        "following": len(followings),
        "last_followers_scan": scan_info.get("last_followers_scan"),
        "last_following_scan": scan_info.get("last_following_scan"),
    })

@api_view(["PUT"])
def update_profile(request):
    auth_header = request.headers.get("Authorization")
    
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        uid = decoded_token['uid']
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)

    data = request.data

    try:
        user_ref = db.collection("users").document(uid)
        user_ref.update(data)
        return Response({"message": "Profile updated successfully"})
    except Exception as e:
        return Response({"error": f"Failed to update profile: {str(e)}"}, status=400)


@api_view(["POST"])
def run_instagram_followers_script(request):
    print("🔥 run_instagram_followers_script triggered")
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)

    cookies = request.data.get("cookies")
    profile_url = request.data.get("profile_url")

    if not cookies or not profile_url:
        return Response({"error": "Missing cookies or profile URL"}, status=400)

    current_status = BotStatusStore.get_status(user_id)

    if current_status and current_status.get("is_running"):
        return Response({"status": "❌ Bot already running for this user"}, status=429)



    if not bot_semaphore.acquire(blocking=False):
        print("⚠️ Too many global bots running. Rejecting.")
        BotStatusStore.set_running(user_id, False)
        return Response(
            {
                "error": "⚠️ Too many users are running bots right now. Please try again in a few moments."
            },
            status=429  # Too Many Requests
        )

    BotStatusStore.set_running(user_id, True)

    def run_bot_async():
        threading.current_thread().name = "followers-bot-thread"

        try:
            print("🔥 run_bot_async STARTED", flush=True)
            count_before = len(FollowerStore.list(user_id))
            bot = InstagramFollowers(user=user_id, cookies=cookies, profile_url=profile_url)
            bot.run()
            count_after = len(FollowerStore.list(user_id))

            if bot.success:
                UserScanInfoStore.update(user_id, last_followers_scan=now())
                BotStatusStore.set_status(user_id, {
                    "type": "followers",
                    "status": "success",
                    "count_before": count_before,
                    "count_after": count_after,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": None
                })
            else:
                BotStatusStore.set_status(user_id, {
                    "type": "followers",
                    "status": "no_change",
                    "count_before": count_before,
                    "count_after": count_after,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": "No new followers found."
                })

        except Exception as e:
            print("❌ Bot crashed:", str(e))
            BotStatusStore.set_status(user_id, {
                "type": "followers",
                "status": "error",
                "count_before": None,
                "count_after": None,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": str(e)
            })
        finally:
            bot_semaphore.release()
            BotStatusStore.set_running(user_id, False)

    Thread(target=run_bot_async).start()

    # ✅ Respond immediately
    return Response({"status": "Bot started"})


@api_view(["POST"])
def run_unfollow_non_followers_script(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)

    cookies = request.data.get("cookies")
    profile_url = request.data.get("profile_url")

    if not cookies or not profile_url:
        return Response({"error": "Missing cookies or profile URL"}, status=400)

    current_status = BotStatusStore.get_status(user_id)

    if current_status and current_status.get("is_running"):
        return Response({"status": "❌ Bot already running for this user"}, status=429)
    
      
    if not bot_semaphore.acquire(blocking=False):
        print("⚠️ Too many global bots running. Rejecting.")
        BotStatusStore.set_running(user_id, False)
        return Response(
            {
                "error": "⚠️ Too many users are running bots right now. Please try again in a few moments."
            },
            status=429  # Too Many Requests
        )
        
    BotStatusStore.set_running(user_id, True)

    def run_bot_async():
        threading.current_thread().name = "unfollow-bot-thread"
        try:
            before_nf = len(list(db.collection("users").document(user_id).collection("non_followers").stream()))
            before_following = len(list(db.collection("users").document(user_id).collection("followings").stream()))

            bot = InstagramUnfollower(user=user_id, cookies=cookies, profile_url=profile_url)
            bot.run()

            after_nf = len(list(db.collection("users").document(user_id).collection("non_followers").stream()))
            after_following = len(list(db.collection("users").document(user_id).collection("followings").stream()))

            if bot.success:
                BotStatusStore.set_status(user_id, {
                    "type": "unfollow",
                    "status": "success",
                    "non_followers_before": before_nf,
                    "non_followers_after": after_nf,
                    "following_before": before_following,
                    "following_after": after_following,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": None
                })
            else:
                BotStatusStore.set_status(user_id, {
                    "type": "unfollow",
                    "status": "no_change",
                    "non_followers_before": before_nf,
                    "non_followers_after": after_nf,
                    "following_before": before_following,
                    "following_after": after_following,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": "No changes made."
                })

        except Exception as e:
            print("❌ Unfollow bot crashed:", str(e))
            BotStatusStore.set_status(user_id, {
                "type": "unfollow",
                "status": "error",
                "non_followers_before": None,
                "non_followers_after": None,
                "following_before": None,
                "following_after": None,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": str(e)
            })
        finally:
            bot_semaphore.release()
            BotStatusStore.set_running(user_id, False)

    Thread(target=run_bot_async).start()

    # ✅ Respond immediately
     # ✅ Respond immediately with the initial counts
    return Response({
        "status": "Bot started",
        "non_followers_before": len(list(db.collection("users").document(user_id).collection("non_followers").stream())),
        "following_before": len(list(db.collection("users").document(user_id).collection("followings").stream()))
    })


@api_view(["POST"])
def run_instagram_following_script(request):
    print("🔥 run_instagram_following_script triggered")
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)

    cookies = request.data.get("cookies")
    profile_url = request.data.get("profile_url")

    if not cookies or not profile_url:
        return Response({"error": "Missing cookies or profile URL"}, status=400)

    current_status = BotStatusStore.get_status(user_id)

    if current_status and current_status.get("is_running"):
        return Response({"status": "❌ Bot already running for this user"}, status=429)


    if not bot_semaphore.acquire(blocking=False):
        print("⚠️ Too many global bots running. Rejecting.")
        BotStatusStore.set_running(user_id, False)
        return Response(
            {
                "error": "⚠️ Too many users are running bots right now. Please try again in a few moments."
            },
            status=429  # Too Many Requests
        )
    
    BotStatusStore.set_running(user_id, True)

    def run_bot_async():
        threading.current_thread().name = "following-bot-thread"
        try:
            print("🔥 run_bot_async STARTED", flush=True)
            before = len(FollowingStore.list(user_id))

            bot = InstagramFollowing(user=user_id, cookies=cookies, profile_url=profile_url)
            bot.run()

            after = len(FollowingStore.list(user_id))

            if bot.success:
                UserScanInfoStore.update(user_id, last_following_scan=now())
                BotStatusStore.set_status(user_id, {
                    "type": "following",
                    "status": "success",
                    "count_before": before,
                    "count_after": after,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": None
                })
            else:
                BotStatusStore.set_status(user_id, {
                    "type": "following",
                    "status": "no_change",
                    "count_before": before,
                    "count_after": after,
                    "timestamp": firestore.SERVER_TIMESTAMP,
                    "message": "No new followings found."
                })

        except Exception as e:
            print("❌ Following bot crashed:", str(e))
            BotStatusStore.set_status(user_id, {
                "type": "following",
                "status": "error",
                "count_before": None,
                "count_after": None,
                "timestamp": firestore.SERVER_TIMESTAMP,
                "message": str(e)
            })
        finally:
            bot_semaphore.release()
            BotStatusStore.set_running(user_id, False)

    Thread(target=run_bot_async).start()

    # ✅ Respond immediately
    return Response({"status": "Bot started"})


@api_view(["GET"])
def check_new_data_flag(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)
    
    flag_path = os.path.join(tempfile.gettempdir(), f"new_data_flag_user_{user_id}.flag")
    return Response({"new_data": os.path.exists(flag_path)})


from datetime import datetime, timezone

@api_view(["GET"])
def check_bot_status(request):
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return Response({"error": "Missing or invalid Authorization header"}, status=401)

    id_token = auth_header.split("Bearer ")[1]

    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
    except Exception as e:
        return Response({"error": f"Invalid token: {str(e)}"}, status=401)

    try:
        doc_ref = db.collection("users").document(user_id).collection("status").document("bot")
        doc = doc_ref.get()

        if not doc.exists:
            return Response({
                "is_running": False,
                "status": None,
                "count_before": None,
                "count_after": None,
                "non_followers_before": None,
                "non_followers_after": None,
                "following_before": None,
                "following_after": None,
                "message": "No bot status found.",
                "type": None,
                "timestamp": None
            })

        data = doc.to_dict()
        is_running = data.get("is_running", False)

        if is_running:
            # ✅ Only return 'is_running' if it's still running
            return Response({ "is_running": True })

        # ✅ If done, return full status
        timestamp_raw = data.get("timestamp")
        if isinstance(timestamp_raw, datetime):
            timestamp = timestamp_raw.strftime("%d:%m:%y")
        else:
            timestamp = None

        return Response({
            "is_running": False,
            "status": data.get("status"),
            "count_before": data.get("count_before"),
            "count_after": data.get("count_after") or data.get("count"),
            "non_followers_before": data.get("non_followers_before"),
            "non_followers_after": data.get("non_followers_after"),
            "following_before": data.get("following_before"),
            "following_after": data.get("following_after"),
            "message": data.get("message"),
            "type": data.get("type"),
            "timestamp": timestamp
        })

    except Exception as e:
        return Response({"error": f"Failed to retrieve bot status: {str(e)}"}, status=500)


@api_view(['POST'])
def run_sync_all_data(request):
    """
    Triggers the combined background task to efficiently sync data.
    Includes robust status checking.
    """
    print("🔥 run_sync_all_data view triggered")

    # --- Authentication ---
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        print("❌ Sync: Missing or invalid Authorization header")
        return Response({"error": "Missing or invalid Authorization header"}, status=status.HTTP_401_UNAUTHORIZED)
    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token, clock_skew_seconds=15)
        user_id = decoded_token["uid"]
        print(f"🔑 Sync: Valid token received for user: {user_id}")
    except Exception as e:
        print(f"❌ Sync: Invalid token error: {str(e)}")
        return Response({"error": f"Invalid token for sync operation: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)

    # --- Get Payload ---
    cookies = request.data.get("cookies")
    profile_url = request.data.get("profile_url")
    if not cookies or not profile_url:
        print(f"❌ Sync: Missing payload for user {user_id}.")
        return Response({"error": "Missing cookies or profile URL"}, status=status.HTTP_400_BAD_REQUEST)

    # --- Concurrency Checks ---
    print(f"🚦 Sync: Checking concurrency for user {user_id}...")
    try:
        current_status = BotStatusStore.get_status(user_id)

        # *** FIX: Check if current_status is a dictionary before calling .get() ***
        is_currently_running = False
        current_type = "unknown"
        if isinstance(current_status, dict):
            is_currently_running = current_status.get("is_running", False)
            current_type = current_status.get("type", "unknown")
        elif current_status is not None:
            # Log if we get an unexpected type (like the boolean)
            print(f"⚠️ Sync: Warning - BotStatusStore.get_status returned unexpected type: {type(current_status)}")

        if is_currently_running:
            print(f"⚠️ Sync: Bot already running for user {user_id} (Type: {current_type}). Rejecting.")
            return Response({"status": f"Bot process ({current_type}) already running"}, status=status.HTTP_429_TOO_MANY_REQUESTS)

    except Exception as e:
         print(f"❌ Sync: Error checking bot status for user {user_id}: {e}")
         traceback.print_exc() # Log the traceback for this error
         return Response({"error": "Failed to check current bot status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # --- Acquire Semaphore ---
    print(f"🚦 Sync: Attempting to acquire global semaphore (Available: {bot_semaphore._value})...")
    if not bot_semaphore.acquire(blocking=False):
        print(f"⚠️ Sync: Too many global bots running. Rejecting request for user {user_id}.")
        return Response({"error": "Too many users are running bots right now."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    print(f"✅ Sync: Semaphore acquired for user {user_id} (Available now: {bot_semaphore._value})")
    semaphore_acquired = True

    # --- Mark as running ---
    try:
        print(f"⏳ Sync: Setting bot status to 'running' for user {user_id}...")
        BotStatusStore.set_running(user_id, True, bot_type="sync_all")
        print(f"✅ Sync: Successfully set 'running' status for user {user_id}.")
    except Exception as e:
        print(f"❌ Sync: Failed to set 'running' status for user {user_id}: {e}. Releasing semaphore.")
        if semaphore_acquired: bot_semaphore.release()
        return Response({"error": "Failed to initialize bot status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # --- Define Async Task ---
    def run_sync_async(uid, cookie_data, p_url):
        thread_name = f"sync-all-thread-{uid}"
        threading.current_thread().name = thread_name
        print(f"🧵 Thread '{thread_name}' started.")
        try:
            print(f"🚀 Calling sync_instagram_data command for user {uid}...", flush=True)
            cookies_json_str = json.dumps(cookie_data)
            call_command('sync_instagram_data', uid, cookies=cookies_json_str, profile_url=p_url)
            print(f"✅ sync_instagram_data command finished execution for user {uid}", flush=True)
        except Exception as e:
            print(f"❌❌ Unhandled exception in sync thread for user {uid}: {str(e)}", flush=True)
            traceback.print_exc()
            try:
                final_check = BotStatusStore.get_status(uid)
                # Check type again before accessing .get()
                if isinstance(final_check, dict) and final_check.get("is_running"):
                    print(f"⚠️ Sync command crashed unexpectedly for {uid}. Setting error status.")
                    BotStatusStore.set_status(uid, {"type": "sync_all", "status": "error", "timestamp": firestore.SERVER_TIMESTAMP, "message": f"Unexpected error during sync: {str(e)}"})
                elif not isinstance(final_check, dict):
                     print(f"⚠️ final_check was not a dict ({type(final_check)}), cannot check is_running after crash for {uid}.")
            except Exception as db_err: print(f"❌❌❌ Failed even to write CRASH error status for sync user {uid}: {str(db_err)}", flush=True)
        finally:
            print(f"🧹 Sync Thread '{thread_name}' cleaning up...")
            try: BotStatusStore.set_running(uid, False); print(f"✅ Set bot status 'not running' for sync user {uid}")
            except Exception as db_err: print(f"❌❌ Failed to set 'not running' status for sync user {uid}: {str(db_err)}", flush=True)
            bot_semaphore.release(); print(f"✅ Semaphore released by sync user {uid} (Available now: {bot_semaphore._value})"); print(f"🧵 Thread '{thread_name}' finished.")

    # --- Start Background Thread ---
    background_thread = Thread(target=run_sync_async, args=(user_id, cookies, profile_url))
    background_thread.start()

    # --- Respond Immediately ---
    print(f"⚡️ Sync bot thread launched for user {user_id}. Responding 202 Accepted.", flush=True)
    return Response({"status": "Sync process accepted and started in background"}, status=status.HTTP_202_ACCEPTED)

@api_view(['GET'])
def get_dashboard_data(request):
    """
    Fetches consolidated data needed for the dashboard display:
    follower/following counts, last sync time, and non-followers list.
    Includes clock skew debugging.
    """
    print(f"\n--- Request received for /dashboard-data at {datetime.now()} ---") # Log request time
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        print("❌ Authorization header missing or invalid format.")
        return Response({"error": "Missing or invalid Authorization header"}, status=status.HTTP_401_UNAUTHORIZED)

    id_token = auth_header.split("Bearer ")[1]
    user_id = None # Initialize user_id

    try:
        # --- Enhanced Clock Skew Debugging ---
        server_time_utc = datetime.now(timezone.utc)
        server_timestamp = int(server_time_utc.timestamp())
        print(f"DEBUG: Server time UTC: {server_time_utc} (Timestamp: {server_timestamp})")

        # Decode token *without* verification just to get 'iat' for debugging
        # Be careful using unverified data in production
        try:
            # Decode without verifying signature, expiry, or audience for debug purposes ONLY
            unverified_payload = jwt.decode(id_token, options={"verify_signature": False, "verify_exp": False, "verify_aud": False})
            token_iat = unverified_payload.get('iat')
            token_exp = unverified_payload.get('exp')
            token_aud = unverified_payload.get('aud') # Audience (Firebase Project ID)
            print(f"DEBUG: Unverified Token - Issued At (iat): {token_iat}, Expires At (exp): {token_exp}, Audience (aud): {token_aud}")
            if token_iat:
                 time_diff = server_timestamp - token_iat
                 print(f"DEBUG: Clock difference (server_now - token_iat): {time_diff} seconds")
                 if abs(time_diff) > 300: # Log warning if skew is large (> 5 minutes)
                     print(f"⚠️ WARNING: Significant clock skew detected ({time_diff}s). Check server time synchronization.")
            else:
                 print("DEBUG: Could not extract 'iat' from token.")
        except Exception as decode_e:
            print(f"DEBUG: Could not decode token for debug info: {decode_e}")
        # --- End Debugging ---

        print(f"Verifying token starting with: {id_token[:15]}...")
        # *** TEMPORARY: Add clock_skew_seconds for debugging ***
        # Increase if needed, but 5-15 seconds should be plenty.
        # REMOVE or set to 0 in production after fixing clock sync.
        decoded_token = firebase_auth.verify_id_token(id_token, clock_skew_seconds=15) # Increased tolerance slightly
        user_id = decoded_token["uid"]
        print(f"✅ Token verified successfully for user: {user_id}")

        # --- If verification succeeds, proceed to fetch data ---
        try:
            print(f"Fetching dashboard data for user: {user_id}")
            # Use Store methods, ensure they return lists or handle None/errors gracefully
            followers_list = FollowerStore.list(user_id) or []
            followings_list = FollowingStore.list(user_id) or []
            non_followers_list = NonFollowerStore.list(user_id) or []
            scan_info = UserScanInfoStore.get(user_id) or {}

            # Determine the most recent sync time from available scan info
            last_sync = scan_info.get("last_sync_all_time") or \
                        scan_info.get("last_followers_scan") or \
                        scan_info.get("last_following_scan") # Add more specific timestamp if available

            print(f"DEBUG: Last sync time: {last_sync}")

            dashboard_data = {
                "followers_count": len(followers_list),
                "following_count": len(followings_list),
                "last_sync_time": last_sync, # Send raw timestamp object or ISO string from Firestore
                "non_followers": non_followers_list, # Assumes list contains {id:..., username:...}
            }
            print(f"✅ Successfully fetched dashboard data for {user_id}")
            return Response(dashboard_data, status=status.HTTP_200_OK)

        except Exception as data_fetch_e:
            # Handle errors during data fetching AFTER successful auth
            print(f"❌ Error fetching dashboard data for {user_id} AFTER auth: {data_fetch_e}")
            traceback.print_exc()
            return Response({"error": "Could not retrieve dashboard data after authentication."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # --- Specific Firebase Auth Error Handling ---
    except firebase_auth.ExpiredIdTokenError as e:
         print(f"❌ TOKEN VERIFICATION FAILED (ExpiredIdTokenError) for user (ID unknown or invalid): {type(e).__name__} - {str(e)}")
         return Response({"error": f"Token has expired. Please log in again. Details: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)
    except firebase_auth.RevokedIdTokenError as e:
         print(f"❌ TOKEN VERIFICATION FAILED (RevokedIdTokenError) for user (ID unknown or invalid): {type(e).__name__} - {str(e)}")
         return Response({"error": f"Token has been revoked. Please log in again. Details: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)
    except firebase_auth.InvalidIdTokenError as e:
        # This catches various issues like clock skew, wrong audience, malformed token etc.
        print(f"❌ TOKEN VERIFICATION FAILED (InvalidIdTokenError) for user (ID unknown or invalid): {type(e).__name__} - {str(e)}")
        # Check specifically for clock skew message
        if 'Token used too early' in str(e) or 'Token used too late' in str(e):
            print("🔴 CLOCK SKEW DETECTED. Please synchronize the server clock with an NTP server.")
        return Response({"error": f"Invalid token provided. Verification failed: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)
    except Exception as e: # Catch any other unexpected errors during verification
         print(f"❌ UNEXPECTED TOKEN VERIFICATION FAILED for user (ID unknown or invalid): {type(e).__name__} - {str(e)}")
         traceback.print_exc()
         return Response({"error": f"Token verification failed unexpectedly: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)