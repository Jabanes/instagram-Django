from base.management.commands.extract_followers import InstagramFollowers
from base.management.commands.extract_following import InstagramFollowing
from rest_framework.response import Response
from rest_framework.decorators import api_view,  permission_classes
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated
from .serializers import RegisterSerializer, MyTokenObtainPairSerializer, UserUpdateSerializer
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import NonFollower, Follower, Following
import subprocess
import os
import tempfile
from django.utils.timezone import now


@api_view(['GET'])
def index(req):
    return Response('Welcome To home page')


# login
class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer



@api_view(['POST'])
def signUp(req):
    serializer = RegisterSerializer(data=req.data)
    if serializer.is_valid():
        serializer.save()
        return Response({'message': 'User created successfully'}, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def get_non_followers(request):
    """Returns the non-followers list for the authenticated user."""
    non_followers_qs = NonFollower.objects.filter(user=request.user)

    non_followers = [
        {"id": nf.id, "username": nf.username}
        for nf in non_followers_qs
    ]
    print(non_followers)

    return Response(
        {"non_followers": non_followers},
        status=status.HTTP_200_OK
    )

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def generateNonFollowersList(request):
    try:
        user = request.user
        user_id = user.id

        # Run the script via subprocess
        subprocess.run(
            ['python', 'manage.py', 'compare_nonfollowers', str(user_id)],
            check=True
        )

        # Fetch updated non-followers from DB
        non_followers_qs = NonFollower.objects.filter(user=user)

        non_followers = [
            {"id": nf.id, "username": nf.username}
            for nf in non_followers_qs
        ]

        user_id = request.user.id
        flag_path = os.path.join(tempfile.gettempdir(), f"new_data_flag_user_{user_id}.flag")

        if os.path.exists(flag_path):
            os.remove(flag_path)  # Reset after detection
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
    
    

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_non_follower(request, id):
    """
    Deletes a non-follower from the user's list using the NonFollower model ID.
    """
    non_follower = get_object_or_404(NonFollower, id=id, user=request.user)
    username = non_follower.username
    non_follower.delete()

    return Response(
        {"message": f"✅ Removed {username} from non-followers list."},
        status=status.HTTP_200_OK
    )

@api_view(["PUT"])
@permission_classes([IsAuthenticated])
def update_profile(request):
    """Allow authenticated users to update their profile."""
    user = request.user
    serializer = UserUpdateSerializer(user, data=request.data, partial=True)

    if serializer.is_valid():
        serializer.save()
        return Response({"message": "Profile updated successfully"}, status=status.HTTP_200_OK)
    
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_instagram_following_script(request):
    user = request.user
    user_id = user.id

    # Step 1: Count following BEFORE the scan
    before_count = Following.objects.filter(user=user).count()

    try:
        # Initialize the Instagramfollowing class
        bot = InstagramFollowing(user=user)

        # Run the extraction and save results to DB
        bot.run()

        # Check if the process was successful
        if bot.success:
            after_count = Following.objects.filter(user=user).count()
            user.scan_info.last_following_scan = now()
            user.scan_info.save()
            print(f"saved last following scan: {now()}")

            return Response({
                'status': 'success',
                'message': f'✅ Saved {after_count} following to the database.',
                'before_count': before_count,
                'after_count': after_count,
            })
        else:
            return Response({
                'status': 'no_change',
                'message': '⚠️ Bot ran successfully, but no new following data was saved.',
                'before_count': before_count,
                'after_count': before_count,  # No change in following count
            })

    except subprocess.CalledProcessError:
        return Response({
            'status': 'error',
            'message': f'❌ Script execution failed for user {user_id}.'
        }, status=500)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_instagram_followers_script(request):
    user = request.user
    user_id = user.id

    # Step 1: Count followers BEFORE the scan
    before_count = Follower.objects.filter(user=user).count()

    try:
        # Initialize the InstagramFollowers class
        bot = InstagramFollowers(user=user)

        # Run the extraction and save results to DB
        bot.run()

        # Check if the process was successful
        if bot.success:
            after_count = Follower.objects.filter(user=user).count()
            user.scan_info.last_followers_scan = now()
            user.scan_info.save()
            print(f"saved last followers scan: {now()}")

            return Response({
                'status': 'success',
                'message': f'✅ Saved {after_count} followers to the database.',
                'before_count': before_count,
                'after_count': after_count,
            })
        else:
            return Response({
                'status': 'no_change',
                'message': '⚠️ Bot ran successfully, but no new followers data was saved.',
                'before_count': before_count,
                'after_count': before_count,  # No change in followers count
            })

    except subprocess.CalledProcessError:
        return Response({
            'status': 'error',
            'message': f'❌ Script execution failed for user {user_id}.'
        }, status=500)
    


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_bot_ready(request):
    user_id = request.user.id
    flag_path = os.path.join(tempfile.gettempdir(), f"ig_ready_user_{user_id}.flag")

    try:
        with open(flag_path, "w") as f:
            f.write("ready")

        return Response({
            "status": "success",
            "message": "✅ Bot confirmed ready. The bot will now continue."
        })
    except Exception as e:
        print(f"[❌ Flag Write Error]: {e}")
        return Response({
            "status": "error",
            "message": "❌ Failed to confirm bot readiness."
        }, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_follow_stats(request):
    user = request.user
    follower_count = Follower.objects.filter(user=user).count()
    following_count = Following.objects.filter(user=user).count()

    scan_info = getattr(user, "scan_info", None)

    return Response({
        "followers": follower_count,
        "following": following_count,
        "last_followers_scan": scan_info.last_followers_scan if scan_info else None,
        "last_following_scan": scan_info.last_following_scan if scan_info else None,
    })

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def check_new_data_flag(request):
    """
    Checks if there is a new data flag for the authenticated user.
    If found, returns `new_data: true` and removes the flag.
    Otherwise, returns `new_data: false`.
    """
    user_id = request.user.id
    flag_path = os.path.join(tempfile.gettempdir(), f"new_data_flag_user_{user_id}.flag")

    if os.path.exists(flag_path):
        return Response({"new_data": True})

    return Response({"new_data": False})

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def run_unfollow_non_followers_script(request):
    user = request.user
    user_id = user.id

    # Count before unfollowing
    before_count = NonFollower.objects.filter(user=user).count()

    try:
        # Run the bot
        subprocess.run(
            ['python', 'manage.py', 'unfollow', str(user_id)],
            check=True
        )

        # Count after
        after_count = NonFollower.objects.filter(user=user).count()

        if after_count < before_count:
            return Response({
                'status': 'success',
                'message': f'✅ Unfollowed {before_count - after_count} users successfully.',
                'before_count': before_count,
                'after_count': after_count,
            })
        else:
            return Response({
                'status': 'no_change',
                'message': '⚠️ Bot ran successfully, but no users were unfollowed.',
                'before_count': before_count,
                'after_count': after_count,
            })

    except subprocess.CalledProcessError:
        return Response({
            'status': 'error',
            'message': f'❌ Unfollow script failed for user {user_id}.'
        }, status=500)
