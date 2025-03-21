from rest_framework.response import Response
from rest_framework.decorators import api_view,  permission_classes
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated
from .serializers import RegisterSerializer, MyTokenObtainPairSerializer, UserUpdateSerializer
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import NonFollower, Follower, Following, UserScanInfo
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
    non_followers = NonFollower.objects.filter(user=request.user).values_list("username", flat=True)
    
    return Response(
        {"non_followers": list(non_followers)},
        status=status.HTTP_200_OK
    )

@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_non_follower(request, username):
    """Deletes a non-follower from the user's list."""
    non_follower = get_object_or_404(NonFollower, user=request.user, username=username)
    non_follower.delete()
    
    return Response(
        {"message": f"Removed {username} from non-followers list."},
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
        # Run the script (no assignment to a variable)
        subprocess.run(
            ['python', 'manage.py', 'extract_following', str(user_id)],
            check=True
        )

        # Step 2: Count following AFTER the scan
        after_count = Following.objects.filter(user=user).count()

        if after_count > before_count:
            user.scan_info.last_followers_scan = now()
            user.scan_info.save()
            
            return Response({
                'status': 'success',
                'message': f'✅ Saved {after_count} following users to the database.'
            })
        else:
            return Response({
                'status': 'no_change',
                'message': '⚠️ Bot ran successfully, but no new following data was saved.'
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
        subprocess.run(
            ['python', 'manage.py', 'extract_followers', str(user_id)],
            check=True
        )

        # Step 2: Count followers AFTER the scan
        after_count = Follower.objects.filter(user=user).count()

        if after_count > before_count:
            user.scan_info.last_followers_scan = now()
            user.scan_info.save()

            return Response({
                'status': 'success',
                'message': f'✅ Saved {after_count} followers to the database.'
            })
        else:
            return Response({
                'status': 'no_change',
                'message': '⚠️ Bot ran, but no new data was saved.'
            })  # 👈 no error status


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

    return Response({
        "followers": follower_count,
        "following": following_count
    })

