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


from datetime import datetime

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
    Triggers the combined background task to efficiently sync
    followers, following, and non-followers data with Firestore.
    """
    print("🔥 run_sync_all_data view triggered")

    # --- Authentication ---
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        print("❌ Missing or invalid Authorization header")
        return Response({"error": "Missing or invalid Authorization header"}, status=status.HTTP_401_UNAUTHORIZED)

    id_token = auth_header.split("Bearer ")[1]
    try:
        decoded_token = firebase_auth.verify_id_token(id_token)
        user_id = decoded_token["uid"]
        print(f"🔑 Valid token received for user: {user_id}")
    except Exception as e:
        print(f"❌ Invalid token error: {str(e)}")
        return Response({"error": f"Invalid token: {str(e)}"}, status=status.HTTP_401_UNAUTHORIZED)

    # --- Get Payload ---
    cookies = request.data.get("cookies")
    profile_url = request.data.get("profile_url")

    if not cookies or not profile_url:
        print(f"❌ Missing payload for user {user_id}. Cookies: {'Present' if cookies else 'Missing'}, URL: {'Present' if profile_url else 'Missing'}")
        return Response({"error": "Missing cookies or profile URL"}, status=status.HTTP_400_BAD_REQUEST)

    # --- Concurrency Checks ---
    print(f"🚦 Checking concurrency for user {user_id}...")
    try:
        current_status = BotStatusStore.get_status(user_id)
        if current_status and current_status.get("is_running"):
            print(f"⚠️ Bot already running for user {user_id} (Type: {current_status.get('type','unknown')}). Rejecting sync request.")
            return Response({"status": f"Bot process ({current_status.get('type','unknown')}) already running for this user"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    except Exception as e:
         print(f"❌ Error checking bot status for user {user_id}: {e}")
         return Response({"error": "Failed to check current bot status."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    print(f"🚦 Attempting to acquire global semaphore (Available: {bot_semaphore._value})...")
    if not bot_semaphore.acquire(blocking=False):
        print(f"⚠️ Too many global bots running. Rejecting request for user {user_id}.")
        return Response(
            {"error": "Too many users are running bots right now. Please try again later."},
            status=status.HTTP_429_TOO_MANY_REQUESTS
        )
    print(f"✅ Semaphore acquired for user {user_id} (Available now: {bot_semaphore._value})")
    semaphore_acquired = True # Flag to track if we need to release

    # --- Mark as running (BEFORE starting thread) ---
    try:
        print(f"⏳ Setting bot status to 'running' for sync user {user_id}...")
        BotStatusStore.set_running(user_id, True, bot_type="sync_all") # Indicate the type
        print(f"✅ Successfully set 'running' status for sync user {user_id}.")
    except Exception as e:
        print(f"❌ Failed to set 'running' status for sync user {user_id}: {e}. Releasing semaphore.")
        if semaphore_acquired:
            bot_semaphore.release()
        return Response({"error": "Failed to initialize bot status. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # --- Define Async Task ---
    def run_sync_async(uid, cookie_data, p_url):
        thread_name = f"sync-all-thread-{uid}"
        threading.current_thread().name = thread_name
        print(f"🧵 Thread '{thread_name}' started.")
        command_succeeded = False # Flag not really used here, command handles status

        try:
            print(f"🚀 Calling sync_instagram_data command for user {uid}...", flush=True)
            cookies_json_str = json.dumps(cookie_data) # *** Ensure json is imported ***

            # Execute the management command - MAKE SURE 'sync_instagram_data' IS THE CORRECT NAME
            call_command('sync_instagram_data', uid, cookies=cookies_json_str, profile_url=p_url)

            # Command is responsible for setting final status (success/no_change/error)
            print(f"✅ sync_instagram_data command finished execution for user {uid}", flush=True)

        except Exception as e:
            print(f"❌❌ Unhandled exception in sync background task for user {uid}: {str(e)}", flush=True)
            try:
                final_check = BotStatusStore.get_status(uid)
                 # *** FIX: Check if final_check is a dictionary before calling .get() ***
                if isinstance(final_check, dict) and final_check.get("is_running"):
                    print(f"⚠️ Sync command crashed unexpectedly for {uid}. Setting generic error status.")
                    BotStatusStore.set_status(uid, {
                        "type": "sync_all",
                        "status": "error",
                        "timestamp": firestore.SERVER_TIMESTAMP,
                        "message": f"Unexpected error during sync: {str(e)}"
                    })
                elif not isinstance(final_check, dict):
                     print(f"⚠️ final_check was not a dict ({type(final_check)}), cannot check is_running after crash for {uid}.")
            except Exception as db_err:
                print(f"❌❌❌ Failed even to write CRASH error status for sync user {uid}: {str(db_err)}", flush=True)
        finally:
            print(f"🧹 Sync Thread '{thread_name}' cleaning up resources...")
            try:
                # Always ensure running is set to false at the end
                BotStatusStore.set_running(uid, False)
                print(f"✅ Set bot status to 'not running' for sync user {uid}")
            except Exception as db_err:
                print(f"❌❌ Failed to set 'not running' status for sync user {uid}: {str(db_err)}", flush=True)
            # Release the semaphore
            bot_semaphore.release()
            print(f"✅ Semaphore released by sync user {uid} (Available now: {bot_semaphore._value})")
            print(f"🧵 Thread '{thread_name}' finished.")


    # --- Start Background Thread ---
    background_thread = Thread(target=run_sync_async, args=(user_id, cookies, profile_url))
    background_thread.start()

    # --- Respond Immediately ---
    print(f"⚡️ Bot thread launched for user {user_id}. Responding 202 Accepted.", flush=True)
    return Response({"status": "Sync process accepted and started in background"}, status=status.HTTP_202_ACCEPTED)
