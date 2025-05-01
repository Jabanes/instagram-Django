// src/components/Dashboard.tsx
import React, { useEffect, useState, useCallback } from 'react';
import axios, { AxiosError } from 'axios'; // Import AxiosError
import { NonFollower } from "../models/NonFollower";
import ConfirmModal from "../components/Confirm";
import { auth } from "../app/firebase";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { onIdTokenChanged, User } from "firebase/auth"; // Import User type
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { login, logout } from '../features/auth/authSlice'; // Assuming logout action clears relevant state
import { log } from 'node:console';

const Dashboard = () => {

  // --- State ---
  const [isAuthReady, setIsAuthReady] = useState(false); // <-- New state flag
  const [isLoadingData, setIsLoadingData] = useState(true); // Loading state for initial data fetch
  const [botRunStatus, setBotRunStatus] = useState<"success" | "error" | "no_change" | "">("");
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null); // 'sync-all' or 'unfollow'
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [nonFollowers, setNonFollowers] = useState<NonFollower[]>([]);
  // Removed separate nonFollowersLoading/Message states, handled by isLoadingData and toast
  const [showEveryoneFollowsModal, setShowEveryoneFollowsModal] = useState(false);

  const EXTENSION_ID = "pfnfjihjeoadnnceeanddmmflkahbfhf"; // Use your actual ID
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // --- Utility Functions ---
  const formatDate = (dateStr: string | null | undefined): string | null => {
    // Handles Firestore Timestamp objects or ISO strings
    if (!dateStr) return null;
    let date: Date | null = null;
    try {
        if (typeof dateStr === 'object' && dateStr !== null && 'toDate' in dateStr) {
             // Handle Firestore Timestamp object
             date = (dateStr as any).toDate();
        } else if (typeof dateStr === 'string') {
             // Handle ISO string
            date = new Date(dateStr);
        }

        if (date && !isNaN(date.getTime())) {
            return date.toLocaleString('en-GB', {
                timeZone: 'Asia/Jerusalem', // Consider making this dynamic
                day: '2-digit', month: '2-digit', year: 'numeric',
                hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            });
        }
    } catch (e) {
        console.error("Error formatting date:", e, "Input:", dateStr);
    }
    return "Invalid Date"; // Return indication of error
  };

  // --- Effect for Auth State & Token Readiness ---
  useEffect(() => {
    console.log("Setting up Firebase Auth listener...");
    const unsubscribe = onIdTokenChanged(auth, async (user: User | null) => {
      if (user) {
        console.log("Auth state changed: User is present.");
        try {
          // Get token *first* to ensure it's fresh
          const token = await user.getIdToken(true); // Force refresh token
          localStorage.setItem("firebase_token", token); // Store for extension use
          console.log(token);
          
          console.log("🔐 Firebase token updated in localStorage.");
          setIsAuthReady(true); // <-- Set auth ready flag HERE

          // Inject token into extension (best effort)
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              EXTENSION_ID,
              { action: "saveFirebaseToken", token },
              (response: any) => {
                 if (chrome.runtime.lastError) {
                     console.warn("Could not send token to extension (listener):", chrome.runtime.lastError.message);
                 } else {
                     console.log("📩 Sent token to extension (listener):", response);
                 }
              }
            );
          } else {
            console.log("ⓘ Chrome runtime not available for token injection (listener).");
          }

        } catch (err) {
          console.error("🔥 Token refresh failed:", err);
          setIsAuthReady(false); // Ensure flag is false if token fails
          // Handle potential logout based on rememberMe
          const remember = localStorage.getItem("rememberMe") === 'true';
          if (!remember) {
            dispatch(logout()); // Dispatch logout action
            navigate("/login");
            toast.warn("Session expired. Please log in again.");
          } else {
            console.warn("⚠️ Token expired, but 'remember me' is enabled.");
          }
        }
      } else {
        console.log("Auth state changed: No user. Cleaning up...");
        // User logged out
        localStorage.removeItem("firebase_token");
        setIsAuthReady(false); // <-- Reset auth ready flag
        // Optional: Clear component state on logout?
        setFollowersCount(0);
        setFollowingCount(0);
        setNonFollowers([]);
        setLastSyncTime(null);
        // Let Redux handle clearing its state via logout action if needed elsewhere
        // dispatch(logout()); // This might be redundant if already handled by slice/listener
        navigate("/login"); // Redirect to login
      }
    });

    // Cleanup function
    return () => {
        console.log("Cleaning up Firebase Auth listener.");
        unsubscribe();
    }
  // Add dependencies that, if changed, should re-run the listener setup (usually just dispatch/navigate)
  }, [dispatch, navigate, EXTENSION_ID]);


  // --- Effect for Bot Status Communication (No changes needed here) ---
  useEffect(() => {
    // ... (keep existing bot status listener logic) ...
     const handleMessage = (message: any) => {
      if (message.action === "botStatusUpdate") { // Use a specific action name
        console.log("Received botStatusUpdate message:", message);
        if (message.status === "running") {
          setIsBotRunning(true);
           chrome.storage?.local?.get("selectedActionLabel", (labelResult) => {
               setSelectedAction(labelResult.selectedActionLabel || "unknown");
               console.log(`🔄 Bot status RUNNING for action: ${labelResult.selectedActionLabel || 'unknown'}`);
            });
        } else if (message.status === "finished") {
          setIsBotRunning(false);
          setSelectedAction(null);
          setBotRunStatus(message.finalStatus || "success");
          toast.success(`Bot process (${message.type || 'task'}) finished!`);
          console.log("✅ Bot status FINISHED. Fetching dashboard data...");
          fetchDashboardData(); // <-- Refresh data after bot finishes
        } else if (message.status === "error") {
            setIsBotRunning(false);
            setSelectedAction(null);
            setBotRunStatus("error");
            toast.error(`Bot process failed: ${message.error || 'Unknown error'}`);
            console.error("❌ Bot process failed:", message.error);
        }
      }
    };
     try {
        if (chrome?.runtime?.onMessage) {
            chrome.runtime.onMessage.addListener(handleMessage);
            console.log("👂 Added listener for bot status updates.");
        } else {
            console.warn("Chrome runtime or onMessage listener not available.");
        }
     } catch (e) { console.error("Error adding runtime message listener:", e); }

     // Check initial running state
     try {
        if (chrome?.storage?.local) {
            chrome.storage.local.get(["bot_is_running", "selectedActionLabel"], (result) => {
                if (chrome.runtime.lastError) { console.warn("Error getting initial bot state:", chrome.runtime.lastError.message); return; }
                if (result.bot_is_running) {
                    console.log("Component mounted: Bot was running according to storage.");
                    setIsBotRunning(true);
                    setSelectedAction(result.selectedActionLabel || "unknown");
                }
            });
        }
     } catch(e) { console.error("Error checking initial bot state:", e); }

     return () => {
       try {
         if (chrome?.runtime?.onMessage) {
           chrome.runtime.onMessage.removeListener(handleMessage);
           console.log("👂 Removed listener for bot status updates.");
         }
       } catch (e) { console.error("Error removing runtime message listener:", e); }
     };
  }, []); // Keep empty dependency array for listener setup/cleanup


  // --- NEW Consolidated Data Fetching Function ---
  const fetchDashboardData = useCallback(async () => {
    // Only proceed if authentication is ready
    if (!isAuthReady) {
      console.log("Auth not ready, skipping data fetch.");
      return;
    }
    console.log("Auth is ready. Fetching dashboard data...");
    setIsLoadingData(true); // Indicate loading starts
    setBotRunStatus(""); // Clear previous run status messages

    try {
      const token = await auth.currentUser?.getIdToken(true); // Get fresh token
      if (!token) {
        throw new Error("Authentication token not available.");
      }

      // Call the new single endpoint
      const response = await axios.get<{
          followers_count: number;
          following_count: number;
          last_sync_time: string | null; // Expect ISO string or null from backend
          non_followers: NonFollower[];
      }>(`${process.env.REACT_APP_API_BASE_URL}/dashboard-data`, { // Ensure path matches urls.py
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = response.data;
      console.log("Received dashboard data:", data);

      // Update state with fetched data
      setFollowersCount(data.followers_count ?? 0);
      setFollowingCount(data.following_count ?? 0);
      setLastSyncTime(formatDate(data.last_sync_time)); // Format the timestamp
      setNonFollowers(data.non_followers || []);

      // Update local storage cache (optional, but good for quick reloads)
      localStorage.setItem("dashboard_cache", JSON.stringify({
          followers_count: data.followers_count ?? 0,
          following_count: data.following_count ?? 0,
          last_sync_time: data.last_sync_time, // Store raw timestamp
          non_followers: data.non_followers || [],
      }));

      // Handle the "everyone follows back" modal logic
      if (data.non_followers?.length === 0 && (data.followers_count > 0 || data.following_count > 0)) {
          setShowEveryoneFollowsModal(true);
      } else {
          setShowEveryoneFollowsModal(false);
      }

    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      // Clear potentially stale data on error
      setFollowersCount(0);
      setFollowingCount(0);
      setNonFollowers([]);
      setLastSyncTime(null);
      if (error.response?.status === 401) {
          toast.error("Authentication error fetching data. Please log in again.");
          // Consider dispatching logout or redirecting
          // dispatch(logout());
          // navigate('/login');
      } else {
          toast.error("Could not load dashboard data. Please try again later.");
      }
    } finally {
      setIsLoadingData(false); // Indicate loading finished
    }
  // Depend on isAuthReady flag
  }, [isAuthReady]); // Removed navigate, dispatch as dependencies for this specific fetch


  // --- Effect to Fetch Initial Data *AFTER* Auth is Ready ---
  useEffect(() => {
      if (isAuthReady) {
          // Attempt to load from cache first for immediate display
          try {
              const cachedData = localStorage.getItem("dashboard_cache");
              if (cachedData) {
                  console.log("Loading data from cache...");
                  const parsedCache = JSON.parse(cachedData);
                  setFollowersCount(parsedCache.followers_count ?? 0);
                  setFollowingCount(parsedCache.following_count ?? 0);
                  setLastSyncTime(formatDate(parsedCache.last_sync_time));
                  setNonFollowers(parsedCache.non_followers || []);
                  setIsLoadingData(false); // Stop initial loading indicator if cache exists
              }
          } catch (e) {
              console.warn("Failed to parse dashboard cache:", e);
              localStorage.removeItem("dashboard_cache");
          }
          // Always fetch fresh data after loading cache (or if no cache)
          fetchDashboardData();
      } else {
          console.log("Waiting for auth to be ready before initial data fetch...");
          setIsLoadingData(true); // Ensure loading is true while waiting for auth
      }
  // Run this effect when isAuthReady changes or fetchDashboardData function reference changes
  }, [isAuthReady, fetchDashboardData]);


  // --- Action Selection (No changes needed here) ---
  const handleSelectAction = useCallback((action: string, callback: () => void) => {
    // ... (keep existing logic) ...
    if (isBotRunning) { toast.warn("A bot process is already running."); return; }
    setBotRunStatus("");
    if (selectedAction === action) {
      setSelectedAction(null);
      try { if (chrome?.runtime?.sendMessage) { chrome.runtime.sendMessage(EXTENSION_ID, { action: "clearSelectedAction" }); } } catch (e) { console.warn("Error sending clear message:", e); }
    } else {
      setSelectedAction(action);
      callback();
    }
  }, [isBotRunning, selectedAction, EXTENSION_ID]);

  // --- Action Trigger Functions (syncAllData, unfollowUsers - No changes needed here) ---
  const syncAllData = useCallback(async () => {
    // Ensure this endpoint matches your urls.py *exactly*
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/sync-all/`; // Example with /api/ prefix and trailing /
    const actionLabel = "Sync All Data";
    console.log(`Preparing action: ${actionLabel} for endpoint: ${endpoint}`);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");
      if (typeof chrome?.runtime?.sendMessage !== 'function') throw new Error("Cannot communicate with extension.");

      const sendToExtension = (message: object) => new Promise((resolve, reject) => { /* ... */ }); // Keep promise wrapper
      await sendToExtension({ action: "saveFirebaseToken", token });
      await sendToExtension({ action: "setTargetEndpoint", endpoint });
      await sendToExtension({ action: "setSelectedAction", label: actionLabel });
      console.log(`📬 Sync Action: Data sent to extension.`);
      toast.info("Sync Data selected! Click the extension icon and 'Send to Bot'.", { autoClose: 6000 });
    } catch (err: any) { /* ... error handling ... */ }
  }, [EXTENSION_ID]);

  const unfollowUsers = useCallback(async () => {
    // Ensure this endpoint matches your urls.py *exactly*
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/api/unfollow/`; // Example with /api/ prefix and trailing /
    const actionLabel = "Unfollow listed users";
    // ... (keep existing logic for unfollow) ...
  }, [EXTENSION_ID, nonFollowers]);

  // --- Delete User from Local List (No changes needed here) ---
  const deleteUserFromList = useCallback((id: string) => {
    // ... (keep existing logic) ...
  }, []);


  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex flex-col items-center justify-start py-16 px-4 relative overflow-hidden">
      {/* Floating Icons */}
      {/* ... (keep existing floating icons jsx) ... */}

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-4xl text-center">
        <h2 className="text-4xl font-bold text-white drop-shadow mb-8">Insta Sync Dashboard</h2>

        {/* Loading Indicator for Initial Data */}
        {isLoadingData && (
            <div className="flex justify-center items-center my-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                <p className="text-white ml-4 text-lg">Loading dashboard data...</p>
            </div>
        )}

        {/* Show content only when not loading initial data */}
        {!isLoadingData && (
            <>
                {/* Sync Control Area */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-6 w-full max-w-md flex flex-col items-center">
                        <h5 className="text-xl font-semibold text-blue-700 mb-2">Account Sync</h5>
                        {lastSyncTime ? (
                            <p className="text-gray-600 text-sm mb-3">Last sync: {lastSyncTime}</p>
                        ) : (
                            <p className="text-gray-500 text-sm mb-3 italic">No sync data available yet.</p>
                        )}
                        <p className="text-md text-gray-800 mb-4">
                            Followers: <span className="font-semibold">{followersCount}</span> | Following: <span className="font-semibold">{followingCount}</span>
                        </p>
                        <button
                            className={`font-semibold px-6 py-3 rounded-lg transition text-white text-lg w-full max-w-xs disabled:opacity-60 disabled:cursor-not-allowed ${
                                isBotRunning && selectedAction !== 'sync-all' ? 'bg-gray-400' :
                                isBotRunning && selectedAction === 'sync-all' ? 'bg-yellow-600 animate-pulse' :
                                selectedAction === "sync-all" ? "bg-green-600 hover:bg-green-700 scale-105 shadow-lg" :
                                "bg-blue-600 hover:bg-blue-700"
                            }`}
                            onClick={() => handleSelectAction("sync-all", syncAllData)}
                            disabled={isBotRunning}
                        >
                            {/* ... button text logic ... */}
                            {isBotRunning && selectedAction === "sync-all" ? "Syncing Data..." :
                             selectedAction === "sync-all" ? "Selected: Sync Data" :
                             "Sync Followers & Following"}
                        </button>
                        {/* ... progress bar ... */}
                    </div>
                    <button onClick={() => fetchDashboardData()}>Check Data</button>      
                </div>
                          
                {/* --- Non-Follower Section --- */}
                <div className="mt-10 relative z-10 w-full max-w-3xl mx-auto">
                    {/* Message Area (e.g., errors during unfollow prep) */}
                    {/* ... (nonFollowersMessage display) ... */}

                    {/* Non-Follower List & Unfollow Button */}
                    {nonFollowers.length > 0 && (
                        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-6">
                            <h3 className="text-white text-2xl font-bold mb-5 text-center">
                                Users Who Don't Follow You Back ({nonFollowers.length})
                            </h3>
                            {/* Unfollow Button */}
                            <div className="flex justify-center mb-6">
                                <button
                                    className={`font-semibold px-6 py-3 rounded-lg transition text-white text-lg disabled:opacity-60 disabled:cursor-not-allowed ${
                                        isBotRunning && selectedAction !== 'unfollow' ? 'bg-gray-400' :
                                        isBotRunning && selectedAction === 'unfollow' ? 'bg-yellow-600 animate-pulse' :
                                        selectedAction === "unfollow" ? "bg-green-600 hover:bg-green-700 scale-105 shadow-lg" :
                                        "bg-red-600 hover:bg-red-700"
                                    }`}
                                    onClick={() => handleSelectAction("unfollow", unfollowUsers)}
                                    disabled={isBotRunning || nonFollowers.length === 0}
                                >
                                    {/* ... button text logic ... */}
                                     {isBotRunning && selectedAction === "unfollow" ? "Unfollowing..." :
                                      selectedAction === "unfollow" ? "Selected: Unfollow List" :
                                      `Unfollow ${nonFollowers.length} Users`}
                                </button>
                            </div>
                            {/* ... progress bar ... */}
                            {/* Instructions */}
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

                    {/* Placeholder when no non-followers */}
                    {nonFollowers.length === 0 && !showEveryoneFollowsModal && (
                        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 max-w-md mx-auto">
                            <p className="text-center text-gray-700">No non-followers found based on the last sync. Use "Sync Data" to update the list.</p>
                        </div>
                    )}

                    {/* Modal for when list is empty after fetch */}
                    <ConfirmModal
                        open={showEveryoneFollowsModal}
                        title="All Good!"
                        message="🎉 Great news! It looks like everyone you follow follows you back."
                        confirmText="Ok"
                        cancelText=""
                        onConfirm={() => setShowEveryoneFollowsModal(false)}
                        onCancel={() => setShowEveryoneFollowsModal(false)}
                    />
                </div>
                {/* --- End Non-Follower Section --- */}
            </>
        )} {/* End !isLoadingData conditional rendering */}

      </div> {/* End Main Content Area */}

      {/* Style block */}
      {/* ... (keep existing style block) ... */}
    </div> // End Page Container
  );
};

export default Dashboard;
