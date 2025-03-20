from rest_framework.response import Response
from rest_framework.decorators import api_view,  permission_classes
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.permissions import IsAuthenticated
from .serializers import RegisterSerializer
from rest_framework import status
from django.shortcuts import get_object_or_404
from .models import NonFollower

@api_view(['GET'])
def index(req):
    return Response('Welcome To home page')


# login
class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        # Add custom columns




        token['username'] = user.username
        # ...
        return token


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

