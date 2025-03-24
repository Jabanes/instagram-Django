# 🛠️ TODO - Instagram Bot Fixes and Features

This file tracks all the pending features, fixes, and improvements needed in the Instagram Unfollow Bot project.

---

## 🔧 Bugs to Fix

- [ ] Wrong `botStatus` after scripts are run – shows an error even though the script completed successfully.

---

## 🚀 Features to Implement

### 🔄 Data Handling
- [ ] Save `last_scan` timestamps for followers and following to the DB.
- [ ] Display last scan info properly on the dashboard (frontend).

### 📋 Unfollow List Features
- [ ] Create editable non-followers list in the UI.
- [ ] Add "Proceed to unfollow?" confirmation alert before executing.
- [ ] Only send the final list to the DB and start unfollowing after confirmation.
- [ ] Restore original non-followers list from DB via a "Restore" button (premium feature).
- [ ] Sort the non-follower list alphabetically using Pandas on every comparison.

### 🔍 UI Enhancements
- [ ] Add search bar to filter unfollow list by username.
- [ ] Add “Ignore User” button (+) next to each entry:
  - Adds to an ignored list that’s excluded in future comparisons.

---

## 🔐 Security & User Account Features

- [ ] Implement logger to track:
  - User ID
  - Date/time
  - Action name (e.g., extract_following, unfollow)
  - Result or exception
- [ ] Add "Forgot My Password" feature:
  - Sends a password reset link/verification to user email.

---

## 💎 Premium Feature Plans

- [ ] Unlimited scans per day
- [ ] More unfollow actions per session
- [ ] Advanced filtering (activity level, follower count, etc.)
- [ ] Scheduled unfollow automation
- [ ] Restore list button (exclusive)
- [ ] PayPal integration to manage roles

---

## 🌐 Future Goals

- [ ] Migrate to Firebase DB for real-time sync
- [ ] Add analytics & stats (follow ratio, growth history)
- [ ] Add Two-Factor Authentication
- [ ] Add AI-based smart cleanup suggestions
- [ ] Mobile-friendly responsive frontend
- [ ] Export unfollow history

