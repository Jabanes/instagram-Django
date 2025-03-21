# 📸 Instagram Unfollow Bot

An automated web scraping tool using **Selenium** + **Django** that helps users manage their Instagram following list. It compares the user's "Following" and "Followers" lists to identify accounts that do not follow back and provides tools to interactively clean up your following.

---

## 🧠 Core Concept

This bot mimics human behavior on Instagram to:
- Extract the **Following** and **Followers** lists using Selenium.
- Compare both lists using **Pandas** to find users that **don't follow you back**.
- Present this list in an editable UI.
- Allow one-click unfollow for selected users.

---

## ⚙️ Tech Stack

- **Backend**: Django (user auth, API views, ORM)
- **Frontend**: React + Redux + TypeScript + Bootstrap
- **Automation**: Python + Selenium + Pandas
- **Database**: SQLite (current), moving to Firebase in the future
- **Payments**: PayPal (planned for premium roles)

---

## ✅ Current Features

- 🔍 Scrape and store:
  - Follower and following lists using management commands.
  - Data is saved to a **SQLite database**, not `.txt` files anymore.
- 📄 Compare lists:
  - Calculate users who **don’t follow you back** (sorted A–Z with Pandas).
  - Stored in DB and synced with the frontend.
- 📋 Editable unfollow list:
  - Users can remove usernames from the auto-generated list before unfollowing.
- 🗑️ One-click unfollow:
  - Executes only after confirmation prompt.
- 👤 Manual login during scraping via browser prompt.

---

## 🚧 Features in Development

### Data Features
- Save and display `last_scan` timestamps for both followers and following per user on the dashboard.

### User Control & UX
- Confirmation modal before executing the unfollow command.
- Editable UI for non-followers list.
- Only update DB and run script after final confirmation.

### Security & Monitoring
- ✅ Implement **user activity logger**:
  - Logs action type, timestamp, and result.
- ✅ Implement **"Forgot My Password"**:
  - Sends password reset verification to the registered email.

---

## 💎 Premium Features (Planned)

- 🔁 **Restore List** button:
  - Reload the original non-followers list from the database after local edits.
- 🔂 Unlimited scans per day.
- 👥 Ability to unfollow more users in one batch.
- 🧼 Unlock smart filters and UI-based cleanup tools.
- ⏱️ Schedule automatic unfollow routines.
- 💬 In-app notifications and analytics.
- 💰 Pay via PayPal to upgrade.

---

## 💡 Future Suggestions

- ☁️ Move DB to **Firebase** for cloud sync and real-time updates.
- 🧠 AI-based suggestions for unfollowing inactive users.
- 📊 Stats & insights (followers ratio over time, growth history).
- 🧪 Unit testing for scraping logic and list comparison.
- 🔐 Two-Factor Authentication support.
- 📱 Mobile-friendly UI.
- 🎨 Full frontend revamp with animations and theming.
- 📥 Export history of unfollowed users.

---

## 🧪 Usage (Django Commands)

Use Django `manage.py` commands instead of raw Python scripts:

```bash
python manage.py extract_followers <user_id>
python manage.py extract_following <user_id>
python manage.py compare_nonfollowers <user_id>
python manage.py unfollow <user_id>
