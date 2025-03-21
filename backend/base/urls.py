from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView
from .views import confirm_bot_ready, get_non_followers, delete_non_follower, run_instagram_followers_script, update_profile, run_instagram_following_script

from . import views
urlpatterns = [
    path('', views.index),
    path('register',views.signUp),
    path('login', TokenObtainPairView.as_view()),  
    path("non-followers", get_non_followers, name="get_non_followers"),
    path("non-followers/delete/<str:username>", delete_non_follower, name="delete_non_follower"),
    path('update-profile', update_profile, name='update_profile'),
    path('get-following', run_instagram_following_script, name='run-following-script'),
    path('get-followers', run_instagram_followers_script),
    path('confirm-bot-ready', confirm_bot_ready),
]
