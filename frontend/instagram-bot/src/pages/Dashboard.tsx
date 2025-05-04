// src/components/Dashboard.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import axios, { AxiosError } from 'axios';
import { NonFollower } from "../models/NonFollower";
import ConfirmModal from "../components/Confirm";
import { auth } from "../app/firebase"; // Firebase auth instance
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { onIdTokenChanged, User, getIdToken } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice'; // Assuming you have this

// Define the shape of the cached data
interface DashboardCache {
    followers_count: number;
    following_count: number;
    last_sync_time: string | null; // Store raw timestamp string/object from backend
    non_followers: NonFollower[];
    cache_timestamp: number; // Added timestamp to potentially invalidate old cache later
}

const CACHE_KEY = "dashboard_cache";
// Optional: Cache validity duration in milliseconds (e.g., 1 hour)
// const CACHE_DURATION_MS = 60 * 60 * 1000;

const Dashboard = () => {

  // --- State ---
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true); // True until cache is checked or fetch completes
  const [botRunStatus, setBotRunStatus] = useState<"success" | "error" | "no_change" | "">("");
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [nonFollowers, setNonFollowers] = useState<NonFollower[]>([]);
  const [showEveryoneFollowsModal, setShowEveryoneFollowsModal] = useState(false);

  const initialFetchDone = useRef(false); // Ref to prevent double initial fetch/load in StrictMode

  const EXTENSION_ID = "pfnfjihjeoadnnceeanddmmflkahbfhf";
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  // --- Utility Functions ---
  const formatDate = (dateStr: string | null | undefined): string | null => {
     if (!dateStr) return null;
    let date: Date | null = null;
    try {
        // Handle Firestore Timestamp object if backend sends it directly (less likely for JSON API)
        if (typeof dateStr === 'object' && dateStr !== null && 'toDate' in dateStr && typeof (dateStr as any).toDate === 'function') {
            date = (dateStr as any).toDate();
        }
        // Handle ISO string (most common for JSON APIs)
        else if (typeof dateStr === 'string') {
            date = new Date(dateStr);
        }
        // Format if valid date object was created
        if (date && !isNaN(date.getTime())) {
            return date.toLocaleString('en-GB', { timeZone: 'Asia/Jerusalem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
        }
    } catch (e) { console.error("Error formatting date:", e, "Input:", dateStr); }
    return "Invalid Date"; // Return indication of error if parsing/formatting fails
  };

  // --- Load Data from Cache ---
  const loadDataFromCache = useCallback(() => {
      try {
          const cachedDataString = localStorage.getItem(CACHE_KEY);
          if (cachedDataString) {
              console.log("Attempting to load data from cache...");
              const parsedCache: DashboardCache = JSON.parse(cachedDataString);

              // Optional: Add more validation checks on parsedCache structure if needed
              if (typeof parsedCache.cache_timestamp !== 'number') {
                   console.warn("Cache data missing timestamp, considering invalid.");
                   localStorage.removeItem(CACHE_KEY);
                   return false;
              }

              // Optional: Check cache age
              // const now = Date.now();
              // if (now - parsedCache.cache_timestamp > CACHE_DURATION_MS) {
              //     console.log("Cache is too old, ignoring.");
              //     localStorage.removeItem(CACHE_KEY);
              //     return false; // Indicate cache was invalid
              // }

              // Update state from valid cache
              setFollowersCount(parsedCache.followers_count ?? 0);
              setFollowingCount(parsedCache.following_count ?? 0);
              setLastSyncTime(formatDate(parsedCache.last_sync_time));
              setNonFollowers(parsedCache.non_followers || []);
              console.log("✅ Cache loaded successfully into state.");
              return true; // Indicate cache was loaded
          }
      } catch (e) {
          console.warn("Failed to parse dashboard cache:", e);
          localStorage.removeItem(CACHE_KEY); // Clear corrupted cache
      }
      console.log("ℹ️ No valid cache found in localStorage.");
      return false; // Indicate no cache loaded
  }, []); // No dependencies needed for this function itself

  // --- Consolidated Data Fetching Function ---
  const fetchDashboardData = useCallback(async (forceRefresh = false) => {
    // forceRefresh is used by the bot listener to ensure it fetches even if auth isn't marked ready yet (edge case)
    if (!isAuthReady && !forceRefresh) {
      console.log("fetchDashboardData: Auth not ready and not forced, skipping.");
      return;
    }

    const currentUser = auth.currentUser;
    if (!currentUser) {
        console.log("fetchDashboardData: No current user found, skipping.");
        setIsLoadingData(false); // Ensure loading stops if called when logged out
        return;
    }

    console.log("fetchDashboardData: Fetching fresh data from backend...");
    setIsLoadingData(true); // Indicate loading for the API call
    setBotRunStatus("");

    try {
      const token = await getIdToken(currentUser, true); // Get fresh token
      console.log(`fetchDashboardData: Using token starting with ${token.substring(0, 10)}...`);

      const response = await axios.get<{
          followers_count: number;
          following_count: number;
          last_sync_time: string | null;
          non_followers: NonFollower[];
      }>(
        `${process.env.REACT_APP_API_BASE_URL}/dashboard-data`, // Ensure URL is correct
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const data = response.data;
      console.log("fetchDashboardData: Received data:", data);

      // Update state
      setFollowersCount(data.followers_count ?? 0);
      setFollowingCount(data.following_count ?? 0);
      setLastSyncTime(formatDate(data.last_sync_time));
      setNonFollowers(data.non_followers || []);

      // Update cache with the fresh data
      const cacheData: DashboardCache = {
          followers_count: data.followers_count ?? 0,
          following_count: data.following_count ?? 0,
          last_sync_time: data.last_sync_time, // Store raw timestamp from backend
          non_followers: data.non_followers || [],
          cache_timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      console.log("fetchDashboardData: Cache updated with fresh data.");

      // Modal logic
      if (data.non_followers?.length === 0 && (data.followers_count > 0 || data.following_count > 0)) {
          setShowEveryoneFollowsModal(true);
      } else { setShowEveryoneFollowsModal(false); }

    } catch (error: any) {
      console.error("fetchDashboardData: Error fetching dashboard data:", error);
      // Avoid clearing state if a fetch fails, keep showing cached data if available
      if (axios.isAxiosError(error) && error.response?.status === 401) {
          toast.error("Authentication error fetching data. Session might be invalid.");
      } else {
          toast.error("Could not load fresh dashboard data. Displaying cached data if available.");
      }
    } finally {
      setIsLoadingData(false); // Loading finishes after attempt
    }
  }, [isAuthReady]); // Depend on isAuthReady to re-create if auth state changes


  // --- Effect for Auth State Change ---
  useEffect(() => {
    console.log("Setting up Firebase Auth listener...");
    setIsAuthReady(false); // Assume not ready initially
    initialFetchDone.current = false; // Reset fetch flag

    const unsubscribe = onIdTokenChanged(auth, async (user: User | null) => {
      if (user) {
        console.log("Auth listener: User detected.");
        setIsAuthReady(true); // Mark auth as ready
        console.log("Auth listener: Auth marked as ready.");

         // Inject token (best effort) - No callback needed here
         try {
            const tokenForExtension = await getIdToken(user, true);
            localStorage.setItem("firebase_token", tokenForExtension);
            if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
                try {
                    // Send without callback
                    chrome.runtime.sendMessage(EXTENSION_ID, { action: "saveFirebaseToken", token: tokenForExtension });
                } catch (extError) { console.warn("Auth listener: Error sending token - ", extError); }
            }
         } catch (tokenError) {
             console.error("Auth listener: Failed to get token for injection:", tokenError);
             setIsAuthReady(false); // Mark as not ready if token fails
             dispatch(logout()); navigate("/login"); toast.error("Session error. Please log in again.");
         }
      } else {
        console.log("Auth listener: No user detected. Cleaning up state...");
        localStorage.removeItem("firebase_token");
        localStorage.removeItem(CACHE_KEY); // <-- Clear cache on logout
        setIsAuthReady(false); setIsLoadingData(false);
        setFollowersCount(0); setFollowingCount(0); setNonFollowers([]); setLastSyncTime(null);
        setSelectedAction(null); setIsBotRunning(false);
        navigate("/login");
      }
    });
    return () => { console.log("Cleaning up Firebase Auth listener."); unsubscribe(); }
  }, [dispatch, navigate, EXTENSION_ID]);


  // --- Effect to Load Initial Data (CACHE OR FETCH) ---
  useEffect(() => {
      // Only run when auth state is confirmed ready AND initial load hasn't happened
      if (isAuthReady && !initialFetchDone.current) {
          console.log("Initial Load Effect: Auth ready, attempting load...");
          initialFetchDone.current = true; // Mark that we've processed the initial load attempt

          // Try loading from cache first
          const cacheLoaded = loadDataFromCache();

          // *** Fetch ONLY if cache was NOT loaded ***
          if (!cacheLoaded) {
              console.log("Initial Load Effect: No valid cache found, fetching from backend...");
              setIsLoadingData(true); // Show loading indicator while fetching
              fetchDashboardData(); // Fetch data because cache is missing/invalid
          } else {
               console.log("Initial Load Effect: Loaded from cache. Background fetch skipped.");
               setIsLoadingData(false); // Cache loaded, stop loading indicator
          }

      } else if (!isAuthReady) {
           console.log("Initial Load Effect: Waiting for auth readiness...");
           setIsLoadingData(true); // Keep loading true while waiting for auth listener
      }
  // Depend on isAuthReady and the memoized functions
  }, [isAuthReady, loadDataFromCache, fetchDashboardData]);


  // --- Effect for Bot Status Communication ---
  useEffect(() => {
     const handleMessage = (message: any) => {
        if (message.action === "botStatusUpdate") {
        console.log("Bot Status Listener: Received update:", message);
        if (message.status === "running") {
             setIsBotRunning(true);
             chrome.storage?.local?.get("selectedActionLabel", (labelResult) => {
                 setSelectedAction(labelResult.selectedActionLabel || "unknown");
             });
        } else if (message.status === "finished") {
          setIsBotRunning(false); setSelectedAction(null); setBotRunStatus(message.finalStatus || "success");
          toast.success(`Bot process (${message.type || 'task'}) finished! Refreshing data...`);
          console.log("Bot Status Listener: Triggering data refresh...");
          // Force refresh after bot finishes, bypassing auth check (we know user is logged in)
          fetchDashboardData(true); // <-- Pass true to force refresh
        } else if (message.status === "error") {
             setIsBotRunning(false); setSelectedAction(null); setBotRunStatus("error");
             toast.error(`Bot process failed: ${message.error || 'Unknown error'}`);
        }
      }
    };
     // Setup/cleanup logic...
     try { if (chrome?.runtime?.onMessage) { chrome.runtime.onMessage.addListener(handleMessage); } } catch (e) { /* ... */ }
     try { if (chrome?.storage?.local) { chrome.storage.local.get(["bot_is_running", "selectedActionLabel"], (result) => { if (chrome.runtime.lastError) { return; } if (result.bot_is_running) { setIsBotRunning(true); setSelectedAction(result.selectedActionLabel || "unknown"); } }); } } catch(e) { /* ... */ }
     return () => { try { if (chrome?.runtime?.onMessage) { chrome.runtime.onMessage.removeListener(handleMessage); } } catch (e) { /* ... */ } };
  // Depend only on fetchDashboardData reference now
  }, [fetchDashboardData]);


  // --- Action Selection ---
  const handleSelectAction = useCallback((action: string, callback: () => void) => {
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

  // --- Action Trigger Functions (fetch token inside) ---
  const syncAllData = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/sync-all`; // Use correct path
    const actionLabel = "Sync All Data";
    console.log(`Preparing action: ${actionLabel} for endpoint: ${endpoint}`);
    try {
      const token = await auth.currentUser?.getIdToken(true); // Get fresh token
      if (!token) throw new Error("Authentication token unavailable.");
      if (typeof chrome?.runtime?.sendMessage !== 'function') throw new Error("Cannot communicate with extension.");
      const sendToExtension = (message: object) => new Promise<void>((resolve, reject) => {
           chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message || "Ext comm failed"));
                else resolve();
            });
      });
      await sendToExtension({ action: "saveFirebaseToken", token });
      await sendToExtension({ action: "setTargetEndpoint", endpoint });
      await sendToExtension({ action: "setSelectedAction", label: actionLabel });
      toast.info("Sync Data selected! Click extension icon...", { autoClose: 6000 });
    } catch (err: any) { toast.error(`Error: ${err.message}`); setSelectedAction(null); }

  }, [EXTENSION_ID]);

  const unfollowUsers = useCallback(async () => {
    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/unfollow`; // Use correct path
    const actionLabel = "Unfollow listed users";
    const usernamesToUnfollow = nonFollowers.map((user) => user.username);
    if (usernamesToUnfollow.length === 0) { toast.warn("No users to unfollow."); setSelectedAction(null); return; }
    console.log(`Preparing action: ${actionLabel} for endpoint: ${endpoint}`);
    try {
      const token = await auth.currentUser?.getIdToken(true); // Get fresh token
      if (!token) throw new Error("Authentication token unavailable.");
      if (typeof chrome?.runtime?.sendMessage !== 'function') throw new Error("Cannot communicate with extension.");
      const sendToExtension = (message: object) => new Promise<void>((resolve, reject) => {
           chrome.runtime.sendMessage(EXTENSION_ID, message, (response) => {
                if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message || "Ext comm failed"));
                else resolve();
            });
      });
      await sendToExtension({ action: "saveFirebaseToken", token });
      await sendToExtension({ action: "setTargetEndpoint", endpoint });
      await sendToExtension({ action: "setSelectedAction", label: actionLabel });
      await sendToExtension({ action: "setUnfollowList", usernames: usernamesToUnfollow }); // Send current list
      console.log(`📬 Unfollow Action: Sent ${usernamesToUnfollow.length} usernames to extension.`);
      toast.info(`Unfollow selected! Click extension icon...`, { autoClose: 6000 });
    } catch (err: any) { toast.error(`Error: ${err.message}`); setSelectedAction(null); }
  }, [EXTENSION_ID, nonFollowers]); // Depends on nonFollowers state

  // --- Delete User from Local List ---
  const deleteUserFromList = useCallback((id: string) => {
     setNonFollowers((prev) => {
        const newList = prev.filter((user) => user.id !== id);
        console.log(`Removed user ID ${id}. New list length: ${newList.length}`);
        // Update cache immediately after local state change
        try {
            const cachedDataString = localStorage.getItem(CACHE_KEY);
            if(cachedDataString) {
                const parsedCache: DashboardCache = JSON.parse(cachedDataString);
                parsedCache.non_followers = newList; // Update the non-followers in cache
                parsedCache.cache_timestamp = Date.now(); // Update timestamp
                localStorage.setItem(CACHE_KEY, JSON.stringify(parsedCache));
                console.log("Cache updated after deleting user from list.");
            }
        } catch(e) { console.warn("Could not update cache after deleting user:", e); }
        return newList;
    });
  }, []);


  // --- JSX Structure ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex flex-col items-center justify-start py-16 px-4 relative overflow-hidden">
      {/* Floating Icons */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
            {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className={`absolute animate-float animation-delay-${i * 200} text-white opacity-20 text-3xl`} style={{ left: `${Math.random() * 100}%`, animationDuration: `${4 + Math.random() * 4}s`, top: `${Math.random() * 100}%` }}>
                {Math.random() > 0.5 ? '❤️' : '👤'}
            </div>
            ))}
        </div>

      {/* Main Content Area */}
      <div className="relative z-10 w-full max-w-4xl text-center">
        <h2 className="text-4xl font-bold text-white drop-shadow mb-8">Insta Sync Dashboard</h2>

        {/* Loading Indicator */}
        {isLoadingData && (
             <div className="flex justify-center items-center my-10">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
                <p className="text-white ml-4 text-lg">Loading dashboard data...</p>
            </div>
        )}

        {/* Content Area */}
        {!isLoadingData && (
            <>
                {/* Sync Control Area */}
                <div className="flex justify-center mb-8">
                    <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-6 w-full max-w-md flex flex-col items-center">
                         <h5 className="text-xl font-semibold text-blue-700 mb-2">Account Sync</h5>
                         {lastSyncTime ? <p className="text-gray-600 text-sm mb-3">Last sync: {lastSyncTime}</p> : <p className="text-gray-500 text-sm mb-3 italic">No sync data available yet.</p>}
                         <p className="text-md text-gray-800 mb-4">Followers: <span className="font-semibold">{followersCount}</span> | Following: <span className="font-semibold">{followingCount}</span></p>
                         <button className={`font-semibold px-6 py-3 rounded-lg transition text-white text-lg w-full max-w-xs disabled:opacity-60 disabled:cursor-not-allowed ${ isBotRunning && selectedAction !== 'sync-all' ? 'bg-gray-400' : isBotRunning && selectedAction === 'sync-all' ? 'bg-yellow-600 animate-pulse' : selectedAction === "sync-all" ? "bg-green-600 hover:bg-green-700 scale-105 shadow-lg" : "bg-blue-600 hover:bg-blue-700" }`} onClick={() => handleSelectAction("sync-all", syncAllData)} disabled={isBotRunning}>
                            {isBotRunning && selectedAction === "sync-all" ? "Syncing Data..." : selectedAction === "sync-all" ? "Selected: Sync Data" : "Sync Followers & Following"}
                         </button>
                         {isBotRunning && selectedAction === "sync-all" && (<div className="w-full h-1 bg-gray-300 rounded-full overflow-hidden mt-3"><div className="h-full bg-green-500 animate-pulse w-full"></div></div>)}
                    </div>
                </div>

                {/* Non-Follower Section */}
                <div className="mt-10 relative z-10 w-full max-w-3xl mx-auto">
                    {/* List & Unfollow Button */}
                    {nonFollowers.length > 0 && (
                        <div className="bg-white/10 backdrop-blur-md rounded-xl shadow-xl p-6">
                            <h3 className="text-white text-2xl font-bold mb-5 text-center">Users Who Don't Follow You Back ({nonFollowers.length})</h3>
                            {/* Unfollow Button */}
                            <div className="flex justify-center mb-6">
                                <button className={`font-semibold px-6 py-3 rounded-lg transition text-white text-lg disabled:opacity-60 disabled:cursor-not-allowed ${ isBotRunning && selectedAction !== 'unfollow' ? 'bg-gray-400' : isBotRunning && selectedAction === 'unfollow' ? 'bg-yellow-600 animate-pulse' : selectedAction === "unfollow" ? "bg-green-600 hover:bg-green-700 scale-105 shadow-lg" : "bg-red-600 hover:bg-red-700" }`} onClick={() => handleSelectAction("unfollow", unfollowUsers)} disabled={isBotRunning || nonFollowers.length === 0}>
                                    {isBotRunning && selectedAction === "unfollow" ? "Unfollowing..." : selectedAction === "unfollow" ? "Selected: Unfollow List" : `Unfollow ${nonFollowers.length} Users`}
                                </button>
                            </div>
                            {isBotRunning && selectedAction === "unfollow" && (<div className="w-full max-w-xs mx-auto h-1 bg-gray-300 rounded-full overflow-hidden mt-1 mb-4"><div className="h-full bg-green-500 animate-pulse w-full"></div></div>)}
                            {/* Instructions */}
                            <h4 className="text-white text-base font-semibold mb-3 text-center">Click ( − ) to exclude users before selecting Unfollow:</h4>
                            {/* List Display */}
                            <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md overflow-y-auto max-h-[400px] border border-gray-200">
                                <ul className="divide-y divide-gray-300">
                                    {nonFollowers.map((user) => (
                                        <li key={user.id} className="flex justify-between items-center px-4 py-2 hover:bg-gray-50">
                                            <span className="text-gray-800 text-sm">{user.username}</span>
                                            <button onClick={() => deleteUserFromList(user.id)} title={`Exclude ${user.username}`} className="text-red-500 hover:text-red-700 font-bold text-xl px-2 leading-none rounded hover:bg-red-100 transition-colors" aria-label={`Exclude ${user.username} from unfollow list`}>−</button>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}
                    {/* Placeholder */}
                    {nonFollowers.length === 0 && !showEveryoneFollowsModal && (
                        <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-md p-6 mt-6 max-w-md mx-auto">
                            <p className="text-center text-gray-700">No non-followers found based on the last sync. Use "Sync Data" to update the list.</p>
                        </div>
                    )}
                    {/* Modal */}
                    <ConfirmModal open={showEveryoneFollowsModal} title="All Good!" message="🎉 Great news! It looks like everyone you follow follows you back." confirmText="Ok" cancelText="" onConfirm={() => setShowEveryoneFollowsModal(false)} onCancel={() => setShowEveryoneFollowsModal(false)} />
                </div>
            </>
        )}
      </div>

      {/* Style block */}
      {/* ... */}
    </div>
  );
};

export default Dashboard;
