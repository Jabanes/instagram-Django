// src/components/nonFollowers.tsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { NonFollower } from "../models/NonFollower";
import Confirm from "../components/Confirm"

type Props = {
  followersCount: number | 0;
  followingCount: number | 0;
  lastFollowersScan: string | null;
  lastFollowingScan: string | null;
  botStatus: "success" | "error" | "no_change" | "";
  newDataDetected: boolean;
  step: "idle" | "waiting" | "ready";
  setStep: React.Dispatch<React.SetStateAction<"idle" | "waiting" | "ready">>;
  checkNewDataFlag: () => void;
};


const NonFollowers: React.FC<Props> = ({
  followersCount,
  followingCount,
  setStep,
  checkNewDataFlag,
}) => {

  const [nonFollowers, setNonFollowers] = useState<NonFollower[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState("Create Non-Follower List");
  const [newDataFlag, setNewDataDetected] = useState<boolean>(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = localStorage.getItem("token");



  // Label logic
  useEffect(() => {
    if (nonFollowers.length === 0) {
      setButtonLabel("Create Non-Follower List");
    } else if (newDataFlag) {
      setButtonLabel("Create NEW Non-Follower List");
    } else {
      setButtonLabel("Reset List");
    }
  }, [nonFollowers, newDataFlag]);

  // Poll for backend flag that notifies about new data
  useEffect(() => {
    checkNewDataFlag();
  }, []);

  const fetchNonFollowers = async () => {
    setLoading(true);
    try {
      const res = await axios.get("http://127.0.0.1:8000/non-followers", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNonFollowers(res.data.non_followers);
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
        "http://127.0.0.1:8000/non-followers/compare",
        null,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      await fetchNonFollowers();
      setMessage("✅ List created successfully.");
      setButtonLabel("Reset List");
      setNewDataDetected(false); // reset trigger flag
    } catch (error) {
      console.error("Error:", error);
      setMessage("⚠️ Failed to create list.");
    }
    setLoading(false);
  };

  const deleteUser = async (id: number) => {
    try {
      await axios.delete(`http://127.0.0.1:8000/non-followers/delete/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setNonFollowers(nonFollowers.filter((user) => user.id !== id));
    } catch (error) {
      setMessage("⚠️ Could not delete user.");
      console.error("Delete error:", error);
    }
  };

  const unfollowUsers = async () => {
    setLoading(true);
    setStep("waiting"); // tell parent to disable ready button, etc.

    try {
      await axios.post("http://127.0.0.1:8000/unfollow", null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      await fetchNonFollowers();
      setMessage("🎉 Unfollowed users successfully.");
      setStep("idle"); // restore state
    } catch (error) {
      setMessage("⚠️ Failed to unfollow.");
      setStep("idle");
    }

    setLoading(false);
  };


  useEffect(() => {
    fetchNonFollowers();
  }, []);

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
              onClick={() => setShowConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded-lg transition disabled:opacity-50"
            >
              Unfollow Listed Users
            </button>

            <Confirm
              open={showConfirm}
              title="Unfollow listed users?"
              message="⚠️ You are about to unfollow all listed users. This action cannot be undone. Are you sure you want to proceed?"
              confirmText="Yes, Unfollow"
              cancelText="Cancel"
              onConfirm={() => {
                unfollowUsers();
                setShowConfirm(false);
              }}
              onCancel={() => setShowConfirm(false)}
            />

          </div>
          <h1 className="text-white text-1xl font-bold mb-4">
            remove users to exclude on unfollow proccess:
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
    </div>
  );
};

export default NonFollowers;
