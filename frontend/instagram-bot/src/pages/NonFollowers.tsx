// src/components/nonFollowers.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { NonFollower } from "../models/NonFollower";
import { useNavigate } from "react-router-dom";
import ConfirmModal from "../components/Confirm";
import { auth } from "../app/firebase";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

type Props = {
  followersCount: number | 0;
  followingCount: number | 0;
  botStatus: "success" | "error" | "no_change" | "";
  selectedAction: string | null;  // ✅ add this line
  handleSelectAction: (action: string, callback: () => void) => void;
};

const NonFollowers: React.FC<Props> = ({
  followersCount,
  followingCount,
  handleSelectAction,
  selectedAction
}) => {
  const [nonFollowers, setNonFollowers] = useState<NonFollower[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState("Create Non-Follower List");
  const [newDataFlag, setNewDataDetected] = useState<boolean>(false);
  const [showEveryoneFollowsModal, setShowEveryoneFollowsModal] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  useEffect(() => {
    const localList = localStorage.getItem("nonFollowers");
    if (localList) {
      setNonFollowers(JSON.parse(localList));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("nonFollowers", JSON.stringify(nonFollowers));
  }, [nonFollowers]);

  useEffect(() => {
    if (nonFollowers.length === 0) {
      setButtonLabel("Create Non-Follower List");
    } else if (newDataFlag) {
      setButtonLabel("Create NEW Non-Follower List");
    } else {
      setButtonLabel("Reset List");
    }
  }, [nonFollowers, newDataFlag]);

  const fetchNonFollowers = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/non-followers`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const formattedUsers: NonFollower[] = res.data.non_followers.map((doc: any) => ({
        id: doc.id,
        username: doc.username,
      }));
      setNonFollowers(formattedUsers);
      return formattedUsers;

    } catch (error) {
      console.error("Error fetching list", error);
      setMessage("⚠️ Could not fetch list.");
    }
    setLoading(false);
  };

  const generateList = async () => {
    setLoading(true);
    try {
      await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/non-followers/compare`,
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const updatedList = await fetchNonFollowers() || [];

      if (updatedList.length === 0) {
        setShowEveryoneFollowsModal(true);
      } else {
        setMessage("✅ List created successfully.");
        setButtonLabel("Reset List");
        setNewDataDetected(false);
      }

    } catch (error) {
      console.error("Error:", error);
      setMessage("⚠️ Failed to create list.");
    }
    setLoading(false);
  };

  const deleteUser = (id: string) => {
    setNonFollowers(nonFollowers.filter((user) => user.id !== id));
  };

  const unfollowUsers = async () => {
    
    
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/unfollow`;
  
    try {
      setLoading(true);
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing Firebase token");
  
      // ✅ Step 1: Update the non-followers list (backend logic still runs)
      const usernamesOnly = nonFollowers.map((user) => user.username);
      await axios.post(
        `${process.env.REACT_APP_API_BASE_URL}/non-followers/update-list`,
        { list: usernamesOnly },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
  
      // ✅ Step 2: Send token to extension
      chrome.runtime.sendMessage("dcoiahgajkjopndopoaeiigpgkhcjocm", {
        action: "saveFirebaseToken",
        token,
      });
  
      // ✅ Step 3: Send unfollow endpoint to extension
      chrome.runtime.sendMessage("dcoiahgajkjopndopoaeiigpgkhcjocm", {
        action: "setTargetEndpoint",
        endpoint
      });
      
      chrome.runtime.sendMessage("dcoiahgajkjopndopoaeiigpgkhcjocm", {
        action: "setSelectedAction",
        label: "Unfollow listed users"  // or "Unfollow", "Get Following", etc.
      });
      
      console.log("📬 Token and unfollow endpoint sent to extension.");
      console.log(`📦 Token: ${token}`);
      console.log(`📦 Endpoint: ${endpoint}`);
  
      toast.info("Unfollow selected! Click the Chrome extension icon and hit 'Send to Bot' to start the script.", {
        position: "top-center",
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });
  
    } catch (error) {
      setMessage("⚠️ Failed to unfollow.");
      console.error("❌ unfollowUsers error:", error);
    }
  
    setLoading(false);
    navigate("/dashboard");
  };

  return (
    <div className="mt-10 relative z-10 w-full max-w-3xl mx-auto">
      {followingCount > 0 && followersCount > 0 && (
        <div className="text-center mb-6">
          <button
            onClick={generateList}
            disabled={loading}
            className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50"
          >
            {loading ? "Loading..." : buttonLabel}
          </button>
        </div>
      )}

      {nonFollowers.length > 0 && (
        <>
          <h3 className="text-white text-2xl font-bold mb-4">
            Found {nonFollowers.length} people who don’t follow you back
          </h3>

          {newDataFlag && (
            <div className="bg-yellow-200 text-yellow-800 rounded-lg px-4 py-2 mb-3">
              ⚠️ New data detected. Generate a new list?
            </div>
          )}

          {message && (
            <div className="bg-blue-100 text-blue-800 rounded-lg px-4 py-2 mb-3">
              {message}
            </div>
          )}

          <div className="flex justify-center mb-4">
            <button
              className={`font-semibold px-4 py-2 rounded-md transition 
                ${selectedAction === "unfollow"
                  ? "bg-green-600 scale-105 shadow-lg"
                  : "bg-pink-600 hover:bg-pink-700"} 
                text-white`}
              onClick={() => handleSelectAction("unfollow", unfollowUsers)}
            >
              Unfollow
            </button>
          </div>

          <h1 className="text-white text-1xl font-bold mb-4">
            Remove users to exclude from unfollow process:
          </h1>
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md overflow-y-auto max-h-[400px] border border-gray-200">
            <ul className="divide-y divide-gray-300">
              {nonFollowers.map((user) => (
                <li
                  key={user.id}
                  className="flex justify-between items-center px-4 py-3"
                >
                  <span className="text-gray-800">{user.username}</span>
                  <button
                    onClick={() => {
                      deleteUser(user.id);
                      setMessage(`✅ Removed ${user.username} successfully.`);
                    }}
                    className="text-red-600 hover:text-red-800 font-bold text-lg"
                  >
                    −
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <ConfirmModal
        open={showEveryoneFollowsModal}
        title="All Good!"
        message="🎉 Everyone you follow follows you back. You might want to scan again later to check for updates."
        confirmText="Scan Again"
        cancelText="Close"
        onConfirm={() => {
          setShowEveryoneFollowsModal(false);
        }}
        onCancel={() => setShowEveryoneFollowsModal(false)}
      />
    </div>
  );
};

export default NonFollowers;