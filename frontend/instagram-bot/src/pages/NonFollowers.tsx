// src/components/nonFollowers.tsx
import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Button, Spinner, Alert } from "react-bootstrap";
import { NonFollower } from "../models/NonFollower";

type Props = {
  followersCount: number | 0;
  followingCount: number | 0;
  lastFollowersScan: string | null;
  lastFollowingScan: string | null;
  botStatus: "success" | "error" | "no_change" | "";
  newDataDetected: boolean;
};

const NonFollowers: React.FC<Props> = ({
  followersCount,
  followingCount,
  lastFollowersScan,
  lastFollowingScan,
  botStatus,
  newDataDetected,
}) => {
  const [nonFollowers, setNonFollowers] = useState<NonFollower[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [buttonLabel, setButtonLabel] = useState("Create Non-Follower List");
  const [newDataFlag, setNewDataDetected] = useState<boolean>(false);

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
    const checkNewDataFlag = async () => {
      try {
        const res = await axios.get("http://127.0.0.1:8000/check-data", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
  
        if (res.data.new_data) {
          setNewDataDetected(true);
        }
      } catch (err) {
        console.error("⚠️ Error checking new data flag:", err);
      }
    };
  
    // ✅ Run immediately on mount
    checkNewDataFlag();
  
    // 🔁 Then start interval polling
    const interval = setInterval(checkNewDataFlag, 5000);
  
    return () => clearInterval(interval);
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
      setMessage("✅ Removed user from list.");
    } catch (error) {
      setMessage("⚠️ Could not delete user.");
      console.error("Delete error:", error);
    }
  };

  const unfollowUsers = async () => {
    setLoading(true);
    try {
      await axios.post("/api/unfollow-non-followers", null, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      await fetchNonFollowers();
      setMessage("🎉 Unfollowed users successfully.");
    } catch (error) {
      setMessage("⚠️ Failed to unfollow.");
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchNonFollowers();
  }, []);

  return (
    <div>
      {followingCount > 0 && followersCount > 0 && (
        <div className="container mt-4">
          <Button onClick={generateList} disabled={loading}>
            {loading ? <Spinner size="sm" /> : buttonLabel}
          </Button>
        </div>
      )}

      {nonFollowers.length > 0 && (
        <div>
          <h3 className="mt-4">
            Found {nonFollowers.length} People who don't follow you back
          </h3>

          {newDataFlag && (
            <Alert variant="warning" className="mt-3">
              ⚠️ New data detected. Generate a new list?
            </Alert>
          )}

          {message && <Alert variant="info">{message}</Alert>}

          <div className="d-flex gap-2 mb-3">
            <Button
              variant="danger"
              onClick={unfollowUsers}
              disabled={loading}
            >
              Unfollow Listed Users
            </Button>
          </div>

          <ul className="list-group">
            {nonFollowers.map((user) => (
              <li
                key={user.id}
                className="list-group-item d-flex justify-content-between align-items-center"
              >
                {user.username}
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => {
                    deleteUser(user.id);
                    setMessage(`✅ Removed ${user.username} successfully.`);
                  }}
                >
                  −
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default NonFollowers;
