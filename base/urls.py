from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView
from .views import get_non_followers, delete_non_follower

from . import views
urlpatterns = [
    path('', views.index),
    path('register',views.signUp),
    path('login', TokenObtainPairView.as_view()),  
    path("non-followers", get_non_followers, name="get_non_followers"),
    path("non-followers/delete/<str:username>", delete_non_follower, name="delete_non_follower"),

]
