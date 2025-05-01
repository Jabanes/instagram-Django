// src/components/Dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react'; // Added useCallback
import axios from 'axios';
// No longer importing NonFollowers component
import { NonFollower } from "../models/NonFollower"; // Import model if needed
import ConfirmModal from "../components/Confirm"; // Import modal
import { auth } from "../app/firebase";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { onIdTokenChanged } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice';

// Define NonFollower type directly or keep import
// type NonFollower = { id: string; username: string; };

const Dashboard = () => {

  // --- State ---
  const [botRunStatus, setBotRunStatus] = useState<"success" | "error" | "no_change" | "">(""); // Status from last completed backend run
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null); // Combined timestamp
  const [selectedAction, setSelectedAction] = useState<string | null>(null); // 'sync-all' or 'unfollow'
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false); // Tracks if *any* backend process is active
  const [nonFollowers, setNonFollowers] = useState<NonFollower[]>([]);
  const [nonFollowersLoading, setNonFollowersLoading] = useState(false);
  const [nonFollowersMessage, setNonFollowersMessage] = useState<string | null>(null);
  const [showEveryoneFollowsModal, setShowEveryoneFollowsModal] = useState(false);

  const EXTENSION_ID = "pfnfjihjeoadnnceeanddmmflkahbfhf"; // Use your actual ID
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // --- Utility Functions ---
  const formatDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    // Example using en-GB locale for DD/MM/YYYY HH:MM:SS format
    return date.toLocaleString('en-GB', {
      timeZone: 'Asia/Jerusalem', // Or your user's local timezone preference
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
  };

  // --- Effects for Auth & Token Injection ---
  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        localStorage.removeItem("firebase_token");
        dispatch(logout());
        navigate("/login");
        return;
      }
      try {
        const token = await user.getIdToken(true);
        localStorage.setItem("firebase_token", token);
      } catch (err) {
        console.error("🔥 Token refresh failed:", err);
        const remember = localStorage.getItem("rememberMe") === 'true';
        if (!remember) {
          dispatch(logout());
          localStorage.clear();
          navigate("/login");
          toast.warn("Session expired. Please log in again.");
        } else {
          console.warn("⚠️ Token expired, but 'remember me' is enabled.");
        }
      }
    });
    return () => unsubscribe();
  }, [dispatch, navigate]);

  useEffect(() => {
    const handleAuthAndInject = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          const token = await user.getIdToken(true);
          localStorage.setItem("firebase_token", token);
          console.log("🔐 Firebase token updated in localStorage.");
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              EXTENSION_ID,
              { action: "saveFirebaseToken", token },
              (response: any) => {
                 if (chrome.runtime.lastError) {
                     console.warn("Could not send token to extension:", chrome.runtime.lastError.message);
                 } else {
                     console.log("📩 Sent token to extension:", response);
                 }
              }
            );
          } else {
            console.log("❌ Chrome runtime not available for token injection.");
          }
        } else {
          localStorage.removeItem("firebase_token");
          console.log("🚪 User logged out, token removed.");
        }
      });
      return () => unsubscribe();
    };
    setTimeout(() => { handleAuthAndInject(); }, 0); // Delay slightly
  }, [EXTENSION_ID]); // Added EXTENSION_ID dependency


  // --- Effect for Bot Status Communication with Extension ---
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "botStatusUpdate") { // Use a specific action name
        console.log("Received botStatusUpdate message:", message);
        if (message.status === "running") {
          setIsBotRunning(true);
          // Attempt to get label from storage if message doesn't contain it reliably
           chrome.storage?.local?.get("selectedActionLabel", (labelResult) => {
               if (labelResult.selectedActionLabel) {
                   setSelectedAction(labelResult.selectedActionLabel);
                   console.log(`🔄 Bot status RUNNING for action: ${labelResult.selectedActionLabel}`);
               } else {
                   setSelectedAction("unknown"); // Or null
                   console.log("🔄 Bot status RUNNING (action unknown)");
               }
            });
        } else if (message.status === "finished") {
          setIsBotRunning(false);
          setSelectedAction(null);
          setBotRunStatus(message.finalStatus || "success"); // Use status from message if provided
          console.log("✅ Bot status FINISHED. Fetching updates...");
          toast.success("Bot process finished!");
          // Refetch data after bot finishes
          fetchStats();
          fetchNonFollowersList();
        } else if (message.status === "error") {
            setIsBotRunning(false);
            setSelectedAction(null);
            setBotRunStatus("error");
            toast.error(`Bot process failed: ${message.error || 'Unknown error'}`);
            console.error("❌ Bot process failed:", message.error);
        }
      }
    };

    // Register listener
    try {
        if (chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(handleMessage);
            console.log("👂 Added listener for bot status updates.");
        } else {
            console.warn("Chrome runtime or onMessage listener not available.");
        }
    } catch (e) {
        console.error("Error adding runtime message listener:", e);
    }


    // Check initial running state from storage when component mounts
    try {
        if (chrome?.storage?.local) {
            chrome.storage.local.get(["bot_is_running", "selectedActionLabel"], (result) => {
                if (chrome.runtime.lastError) {
                    console.warn("Error getting initial bot state from storage:", chrome.runtime.lastError.message);
                    return;
                }
                if (result.bot_is_running) {
                    console.log("Component mounted: Bot was running according to storage.");
                    setIsBotRunning(true);
                    setSelectedAction(result.selectedActionLabel || "unknown");
                }
            });
        }
    } catch(e) {
        console.error("Error checking initial bot state:", e);
    }

    return () => {
      try {
        if (chrome?.runtime?.onMessage) {
          chrome.runtime.onMessage.removeListener(handleMessage);
          console.log("👂 Removed listener for bot status updates.");
        }
      } catch (e) {
         console.error("Error removing runtime message listener:", e);
      }
    };
  }, []); // Removed dependencies, listener logic should be stable


  // --- Data Fetching ---
  const fetchStats = useCallback(async () => {
    console.log("Fetching stats...");
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        console.log("No token for fetchStats");
        return;
      }

      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/follow-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const { followers, following, last_followers_scan, last_following_scan } = response.data;
      const validFollowers = Number.isFinite(followers) ? followers : 0;
      const validFollowing = Number.isFinite(following) ? following : 0;

      setFollowersCount(validFollowers);
      setFollowingCount(validFollowing);
      const lastSync = last_followers_scan || last_following_scan; // Backend should update these after sync-all
      setLastSyncTime(formatDate(lastSync));

      localStorage.setItem("cached_stats", JSON.stringify({
         followers: validFollowers, following: validFollowing, last_followers_scan, last_following_scan
       }));
       console.log(`Stats fetched: F:${validFollowers}, Fg:${validFollowing}`);

    } catch (err: any) {
      console.error("Failed to fetch follow stats:", err);
      if (err.response?.status === 401) {
          toast.error("Authentication error fetching stats. Please log in again.");
          // Potentially trigger logout
      } else {
          toast.error("Could not load follower/following counts.");
      }
    }
  }, []);

  const fetchNonFollowersList = useCallback(async () => {
      console.log("Fetching non-followers list...");
      setNonFollowersLoading(true);
      setNonFollowersMessage(null);
      try {
          const token = await auth.currentUser?.getIdToken();
          if (!token) throw new Error("Authentication token not available.");

          const res = await axios.get<{ non_followers: any[] }>(`${process.env.REACT_APP_API_BASE_URL}/non-followers`, {
              headers: { Authorization: `Bearer ${token}` },
          });

          const formattedUsers: NonFollower[] = (res.data.non_followers || []).map((doc: any) => ({
              id: doc.id,
              username: doc.username,
          }));

          setNonFollowers(formattedUsers);
          console.log(`Loaded ${formattedUsers.length} non-followers.`);

          // Only show "All Good" modal if counts > 0 but list is empty
          if (formattedUsers.length === 0 && (followersCount > 0 || followingCount > 0)) {
               setShowEveryoneFollowsModal(true);
          } else {
              setShowEveryoneFollowsModal(false);
          }

      } catch (error: any) {
          console.error("Error fetching non-follower list:", error);
          setNonFollowersMessage("⚠️ Could not fetch non-follower list.");
          setNonFollowers([]);
          if (error.response?.status !== 401) { // Don't double-toast on auth errors
             toast.error("Failed to load non-followers list.");
          }
      } finally {
          setNonFollowersLoading(false);
      }
  // Include counts in dependency array because the logic for the modal depends on them
  }, [followersCount, followingCount]);


  // Fetch initial data on mount
  useEffect(() => {
    fetchStats();
    fetchNonFollowersList();
  // fetchStats and fetchNonFollowersList are memoized with useCallback
  // Adding them to dependency array ensures they run correctly if their own dependencies change (though unlikely here)
  // and satisfies exhaustive-deps lint rule.
  }, [fetchStats, fetchNonFollowersList]);


  // --- Action Selection ---
  const handleSelectAction = useCallback((action: string, callback: () => void) => {
    if (isBotRunning) {
      toast.warn("A bot process is already running.");
      return;
    }
    setNonFollowersMessage(null); // Clear list-specific messages
    setBotRunStatus(""); // Clear previous run status

    if (selectedAction === action) {
      setSelectedAction(null); // Toggle off
      try { // Attempt to clear extension state
        if (chrome?.runtime?.sendMessage) {
           chrome.runtime.sendMessage(EXTENSION_ID, { action: "clearSelectedAction" }, (response) => {
                if (chrome.runtime.lastError) console.warn("Could not clear extension state:", chrome.runtime.lastError.message);
            });
        }
      } catch (e) { console.warn("Error sending clear message:", e); }
    } else {
      setSelectedAction(action); // Toggle on
      callback(); // Call the associated function (syncAllData or unfollowUsers)
    }
  }, [isBotRunning, selectedAction, EXTENSION_ID]); // Include EXTENSION_ID

  // --- Action Trigger Functions ---
  const syncAllData = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/sync-all`;
    const actionLabel = "Sync All Data";
    console.log(`Preparing action: ${actionLabel} for endpoint: ${endpoint}`);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      if (typeof chrome?.runtime?.sendMessage !== 'function') {
          throw new Error("Cannot communicate with extension. Is it installed and enabled?");
      }

      // Send data to extension - wrap in promises for potential async handling (optional)
      const sendToExtension = (message: object) => new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
              if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message || "Extension communication failed"));
              } else {
                  resolve(response);
              }
          });
      });

      await sendToExtension({ action: "saveFirebaseToken", token });
      await sendToExtension({ action: "setTargetEndpoint", endpoint });
      await sendToExtension({ action: "setSelectedAction", label: actionLabel });

      console.log(`📬 Sync Action: Data sent to extension.`);
      toast.info("Sync Data selected! Click the extension icon and 'Send to Bot'.", { autoClose: 6000 });

    } catch (err: any) {
      console.error("❌ Failed to prepare sync-all command:", err);
      toast.error(`Error: ${err.message || 'Failed to communicate with extension.'}`);
      setBotRunStatus("error");
      setSelectedAction(null); // Deselect on error
    }
  }, [EXTENSION_ID]);

  const unfollowUsers = useCallback(async () => {
    setNonFollowersMessage(null);
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/unfollow/`;
    const actionLabel = "Unfollow listed users";
    console.log(`Preparing action: ${actionLabel} for endpoint: ${endpoint}`);

    const usernamesToUnfollow = nonFollowers.map((user) => user.username);
    if (usernamesToUnfollow.length === 0) {
        toast.info("No users remaining in the list to unfollow.");
        setSelectedAction(null);
        return;
    }

    try {
        setNonFollowersLoading(true); // Indicate preparation
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please log in again.");

        if (typeof chrome?.runtime?.sendMessage !== 'function') {
            throw new Error("Cannot communicate with extension. Is it installed and enabled?");
        }

        // Optional: Update backend list *before* triggering unfollow via extension?
        // This depends on whether your /unfollow endpoint expects an up-to-date list
        // or works based on the non_followers collection directly. If it works directly,
        // you might *not* need the /non-followers/update-list call. Let's assume it's not needed.
        // const updateListPayload = { list: usernamesToUnfollow };
        // await axios.post( `${process.env.REACT_APP_API_BASE_URL}/non-followers/update-list/`,
        //     updateListPayload, { headers: { Authorization: `Bearer ${token}` } }
        // );
        // console.log("Temporary non-follower list updated on backend.");


        const sendToExtension = (message: object) => new Promise((resolve, reject) => {
          chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
              if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message || "Extension communication failed"));
              } else {
                  resolve(response);
              }
          });
       });

        await sendToExtension({ action: "saveFirebaseToken", token });
        await sendToExtension({ action: "setTargetEndpoint", endpoint });
        await sendToExtension({ action: "setSelectedAction", label: actionLabel });

        console.log(`📬 Unfollow Action: Data sent to extension.`);
        toast.info(`Unfollow for ${usernamesToUnfollow.length} users selected! Click the extension icon and 'Send to Bot'.`, { autoClose: 6000 });

    } catch (err: any) {
        console.error("❌ Failed to prepare unfollow command:", err);
        toast.error(`Error: ${err.message || 'Failed to communicate with extension.'}`);
        setBotRunStatus("error");
        setSelectedAction(null);
    } finally {
        setNonFollowersLoading(false);
    }
  }, [EXTENSION_ID, nonFollowers]);

  // Delete User from Local Display List
  const deleteUserFromList = useCallback((id: string) => {
    setNonFollowers((prev) => {
        const userToRemove = prev.find(u => u.id === id);
        console.log(`Removing user ${userToRemove?.username || id} from local display list.`);
        return prev.filter((user) => user.id !== id)
    });
    setNonFollowersMessage(null);
  }, []);


  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex flex-col items-center justify-start py-16 px-4 relative overflow-hidden">
      {/* Floating Icons */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
         {Array.from({ length: 15 }).map((_, i) => (
           <div
             key={i}
             className={`absolute animate-float animation-delay-${i * 200} text-white opacity-20 text-3xl`}
             style={{
               left: `${Math.random() * 100}%`,
               animationDuration: `${4 + Math.random() * 4}s`,
               top: `${Math.random() * 100}%`,
             }}
           >
             {Math.random() > 0.5 ? '❤️' : '👤'}
           </div>
         ))}
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-4xl text-center">
        <h2 className="text-4xl font-bold text-white drop-shadow mb-8">Insta Sync Dashboard</h2>

        {/* Sync Control Area */}
        <div className="flex justify-center mb-8">
           <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-6 w-full max-w-md flex flex-col items-center">
             <h5 className="text-xl font-semibold text-blue-700 mb-2">Account Sync</h5>
             {lastSyncTime ? (
                 <p className="text-gray-600 text-sm mb-3">
                     Last sync: {lastSyncTime}
                 </p>
             ) : (
                 <p className="text-gray-500 text-sm mb-3 italic">No sync data available yet.</p>
             )}
             <p className="text-md text-gray-800 mb-4">
                Followers: <span className="font-semibold">{followersCount}</span> | Following: <span className="font-semibold">{followingCount}</span>
             </p>
             <button
               className={`font-semibold px-6 py-3 rounded-lg transition text-white text-lg w-full max-w-xs disabled:opacity-60 disabled:cursor-not-allowed
                 ${isBotRunning && selectedAction !== 'sync-all' ? 'bg-gray-400' : // Different disable style if other bot running
                  isBotRunning && selectedAction === 'sync-all' ? 'bg-yellow-600 animate-pulse' : // Specific style when this action running
                  selectedAction === "sync-all" ? "bg-green-600 hover:bg-green-700 scale-105 shadow-lg" : // Selected style
                  "bg-blue-600 hover:bg-blue-700" // Default style
                 }`}
               onClick={() => handleSelectAction("sync-all", syncAllData)}
               disabled={isBotRunning} // Disable if *any* bot is running
             >
               {isBotRunning && selectedAction === "sync-all" ? "Syncing Data..." :
                selectedAction === "sync-all" ? "Selected: Sync Data" :
                "Sync Followers & Following"}
             </button>
             {isBotRunning && selectedAction === "sync-all" && (
                 <div className="w-full h-1 bg-gray-300 rounded-full overflow-hidden mt-3">
                     <div className="h-full bg-green-500 animate-pulse w-full"></div>
                 </div>
             )}
          </div>
        </div>

        {/* --- Non-Follower Section --- */}
        <div className="mt-10 relative z-10 w-full max-w-3xl mx-auto">

          {/* Loading State */}
          {nonFollowersLoading && (
              <p className="text-white text-center py-4 text-lg">🔄 Loading non-followers list...</p>
          )}

          {/* Message Area */}
          {!nonFollowersLoading && nonFollowersMessage && (
             <div className={`rounded-lg px-4 py-3 mb-4 text-center font-medium shadow ${nonFollowersMessage.startsWith('⚠️') ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
               {nonFollowersMessage}
             </div>
          )}

          {/* Non-Follower List & Unfollow Button (Show only if not loading and list has items) */}
          {!nonFollowersLoading && nonFollowers.length > 0 && (
            <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-6">
              <h3 className="text-white text-2xl font-bold mb-5 text-center">
                Users Who Don't Follow You Back ({nonFollowers.length})
              </h3>

              {/* Unfollow Button */}
              <div className="flex justify-center mb-6">
                <button
                  className={`font-semibold px-6 py-3 rounded-lg transition text-white text-lg disabled:opacity-60 disabled:cursor-not-allowed
                    ${isBotRunning && selectedAction !== 'unfollow' ? 'bg-gray-400' : // Different disable style
                      isBotRunning && selectedAction === 'unfollow' ? 'bg-yellow-600 animate-pulse' : // Specific style when running
                      selectedAction === "unfollow" ? "bg-green-600 hover:bg-green-700 scale-105 shadow-lg" : // Selected style
                      "bg-red-600 hover:bg-red-700" // Default style for unfollow
                    }`}
                  onClick={() => handleSelectAction("unfollow", unfollowUsers)}
                  disabled={isBotRunning || nonFollowers.length === 0} // Disable if bot running OR list empty after edits
                >
                  {isBotRunning && selectedAction === "unfollow" ? "Unfollowing..." :
                   selectedAction === "unfollow" ? "Selected: Unfollow List" :
                   `Unfollow ${nonFollowers.length} Users`}
                </button>
              </div>
               {isBotRunning && selectedAction === "unfollow" && (
                 <div className="w-full max-w-xs mx-auto h-1 bg-gray-300 rounded-full overflow-hidden mt-1 mb-4">
                     <div className="h-full bg-green-500 animate-pulse w-full"></div>
                 </div>
               )}

              {/* Instructions for list editing */}
              <h4 className="text-white text-base font-semibold mb-3 text-center">
                Click ( − ) to exclude users before selecting Unfollow:
              </h4>

              {/* List Display */}
              <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md overflow-y-auto max-h-[400px] border border-gray-200">
                 <ul className="divide-y divide-gray-300">
                   {nonFollowers.map((user) => (
                     <li key={user.id} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                       <span className="text-gray-800 text-sm">{user.username}</span>
                       <button
                         onClick={() => deleteUserFromList(user.id)}
                         title={`Exclude ${user.username}`}
                         className="text-red-500 hover:text-red-700 font-bold text-xl px-2 leading-none rounded hover:bg-red-100 transition-colors"
                         aria-label={`Exclude ${user.username} from unfollow list`}
                       >
                         −
                       </button>
                     </li>
                   ))}
                 </ul>
              </div>
            </div>
          )}

          {/* Placeholder when no non-followers and not loading */}
           {!nonFollowersLoading && nonFollowers.length === 0 && !showEveryoneFollowsModal && (
               <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 max-w-md mx-auto">
                   <p className="text-center text-gray-700">No non-followers found based on the last sync. Use "Sync Data" to update the list.</p>
               </div>
           )}

           {/* Modal for when list is empty after fetch and user has followers/following */}
           <ConfirmModal
             open={showEveryoneFollowsModal}
             title="All Good!"
             message="🎉 Great news! It looks like everyone you follow follows you back."
             confirmText="Ok" // Simpler confirmation
             cancelText="" // No cancel needed
             onConfirm={() => setShowEveryoneFollowsModal(false)}
             onCancel={() => setShowEveryoneFollowsModal(false)} // Still needed to close
           />
        </div>
        {/* --- End Non-Follower Section --- */}

      </div> {/* End Main Content Area */}

      {/* Style block */}
      <style>{`
        @keyframes float {
          0% { transform: translateY(0); opacity: 0.2; }
          50% { transform: translateY(-20px); opacity: 0.5; }
          100% { transform: translateY(0); opacity: 0.2; }
        }
        .animate-float {
          animation: float infinite ease-in-out;
        }
        .animation-delay-200 { animation-delay: 0.2s; }
        .animation-delay-400 { animation-delay: 0.4s; }
        /* Add more delays as needed up to 2800 for 15 items */
        .animation-delay-600 { animation-delay: 0.6s; }
        .animation-delay-800 { animation-delay: 0.8s; }
        .animation-delay-1000 { animation-delay: 1.0s; }
        .animation-delay-1200 { animation-delay: 1.2s; }
        .animation-delay-1400 { animation-delay: 1.4s; }
        .animation-delay-1600 { animation-delay: 1.6s; }
        .animation-delay-1800 { animation-delay: 1.8s; }
        .animation-delay-2000 { animation-delay: 2.0s; }
        .animation-delay-2200 { animation-delay: 2.2s; }
        .animation-delay-2400 { animation-delay: 2.4s; }
        .animation-delay-2600 { animation-delay: 2.6s; }
        .animation-delay-2800 { animation-delay: 2.8s; }

       `}</style>
    </div> // End Page Container
  );
};

export default Dashboard;