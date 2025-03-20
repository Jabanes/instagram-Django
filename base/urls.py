from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView

from . import views
urlpatterns = [
    path('', views.index),
    path('register',views.signUp),
    path('login', TokenObtainPairView.as_view()),  

]
