from django.contrib import admin
from .models import NonFollower

class NonFollowerAdmin(admin.ModelAdmin):
    list_display = ("user", "username")
    search_fields = ("username", "user__username")
    list_filter = ("user",)

admin.site.register(NonFollower, NonFollowerAdmin)