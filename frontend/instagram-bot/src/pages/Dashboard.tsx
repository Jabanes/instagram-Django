import { useEffect, useState } from 'react';
import axios from 'axios';
import NonFollowers from './NonFollowers';
import { auth } from "../app/firebase";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { onIdTokenChanged } from "firebase/auth";
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice';

const Dashboard = () => {

  const formatDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return date.toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  const [botStatus, setBotStatus] = useState<"success" | "error" | "no_change" | "">("");
  const [followersCount, setFollowersCount] = useState<number>(() => {
    const cache = localStorage.getItem("cached_stats");
    return cache ? JSON.parse(cache).followers : 0;
  });

  const [followingCount, setFollowingCount] = useState<number>(() => {
    const cache = localStorage.getItem("cached_stats");
    return cache ? JSON.parse(cache).following : 0;
  });
  const [lastFollowersScan, setLastFollowersScan] = useState<string | null>(() => {
    const cache = localStorage.getItem("cached_stats");
    return cache ? formatDate(JSON.parse(cache).last_followers_scan) : null;
  });

  const [lastFollowingScan, setLastFollowingScan] = useState<string | null>(() => {
    const cache = localStorage.getItem("cached_stats");
    return cache ? formatDate(JSON.parse(cache).last_following_scan) : null;
  });

  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);

  const EXTENSION_ID = "kpobldejmmgjpcipmkiidcgcmegideph"; // Replace with your extension ID
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (!user) {
        // User signed out
        localStorage.removeItem("firebase_token");
        dispatch(logout());
        navigate("/login");
        return;
      }

      try {
        const token = await user.getIdToken(true); // force refresh
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
          console.warn("⚠️ Token expired, but 'remember me' is enabled — user stays logged in.");
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const handleAuthAndInject = async () => {
      const unsubscribe = auth.onAuthStateChanged(async (user) => {
        if (user) {
          const token = await user.getIdToken(true);
          localStorage.setItem("firebase_token", token);
          console.log("🔐 Firebase token stored in localStorage.");

          // ✅ Inject into extension
          if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
            chrome.runtime.sendMessage(
              EXTENSION_ID, // your extension ID
              { action: "saveFirebaseToken", token },
              (response: any) => {
                console.log("📩 Sent token to extension:", response);
              }
            );
          } else {
            console.log("❌ Chrome runtime not available.");
          }

        } else {
          localStorage.removeItem("firebase_token");
          console.log("🚪 User logged out, token removed.");
        }
      });

      return () => unsubscribe();
    };

    // Delay until after full mount
    setTimeout(() => {
      handleAuthAndInject();
    }, 0);
  }, []);

  useEffect(() => {
    const handleMessage = (message: any, sender: any, sendResponse: any) => {
      if (message.action === "botStatus") {
        if (message.status === "running") {
          setIsBotRunning(true);
          console.log("🔄 Bot status: RUNNING");
        } else if (message.status === "finished") {
          setIsBotRunning(false);
          console.log("✅ Bot status: FINISHED");
        }
      }
    };

    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
    }

    return () => {
      if (chrome?.runtime?.onMessage) {
        chrome.runtime.onMessage.removeListener(handleMessage);
      }
    };
  }, []);



  const handleSelectAction = (action: string, callback: () => void) => {
    if (selectedAction === action) {
      setSelectedAction(null); // Toggle off
    } else {
      setSelectedAction(action); // Toggle on
      callback(); // Call original function
    }
  };


  useEffect(() => {
    console.log(botStatus);

  }, [botStatus])

  useEffect(() => {


    fetchStats();
  }, []);


  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${process.env.REACT_APP_API_BASE_URL}/follow-stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const { followers, following, last_followers_scan, last_following_scan } = response.data;

      setFollowersCount(followers);
      setFollowingCount(following);

      localStorage.setItem("cached_stats", JSON.stringify({
        followers, following,
        last_followers_scan,
        last_following_scan
      }));

    } catch (err) {
      console.error("Failed to fetch follow stats:", err);
    }
  };

  
  const getFollowing = async () => {
    setBotStatus("");

    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/get-following`;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing Firebase token");

      // ✅ Send token to extension
      chrome.runtime.sendMessage(EXTENSION_ID, {
        action: "saveFirebaseToken",
        token
      });

      // ✅ Send endpoint to extension
      chrome.runtime.sendMessage(EXTENSION_ID, {
        action: "setTargetEndpoint",
        endpoint

      });

      chrome.runtime.sendMessage(EXTENSION_ID, {
        action: "setSelectedAction",
        label: "Scan Following"  // or "Unfollow", "Get Following", etc.
      });


      // console.log("📬 Token and endpoint sent to extension.");

      toast.info("Following Selected! Click the Chrome extension icon and hit 'Send to Bot' to start the script.", {
        position: "top-center",
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });

      // // Optional: log to track
      // console.log(`📦 Token: ${token}`);
      // console.log(`📦 Endpoint: ${endpoint}`);

    } catch (err) {
      console.error("❌ Failed to prepare bot command:", err);
      setBotStatus("error");
    }
  };

  const getFollowers = async () => {
    setBotStatus("");

    const endpoint = `${process.env.REACT_APP_API_BASE_URL}/get-followers`;

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Missing Firebase token");

      // ✅ Send token to extension
      chrome.runtime.sendMessage(EXTENSION_ID, {
        action: "saveFirebaseToken",
        token
      });

      // ✅ Send endpoint to extension
      chrome.runtime.sendMessage(EXTENSION_ID, {
        action: "setTargetEndpoint",
        endpoint
      });

      chrome.runtime.sendMessage(EXTENSION_ID, {
        action: "setSelectedAction",
        label: "Scan Followers"  // or "Unfollow", "Get Following", etc.
      });

      // console.log("📬 Token and endpoint sent to extension.");
      // console.log(`📦 Token: ${token}`);
      // console.log(`📦 Endpoint: ${endpoint}`);

      toast.info("Followers Selected! Click the Chrome extension icon and hit 'Send to Bot' to start the script.", {
        position: "top-center",
        autoClose: 6000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "colored",
      });

    } catch (err) {
      console.error("❌ getFollowers error:", err);
      setBotStatus("error");
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex flex-col items-center justify-start py-16 px-4 relative overflow-hidden">
      {/* Floating animated icons */}


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

      <div className="relative z-10 w-full max-w-4xl text-center">
        <h2 className="text-4xl font-bold text-white drop-shadow mb-8">Dashboard</h2>

        <div className="flex flex-wrap justify-center gap-6">
          <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-6 w-64">
            <h5 className="text-xl font-semibold text-pink-600">Followers</h5>
            {lastFollowersScan && <p className="mt-2 text-gray-600 text-sm">Last scanned: {lastFollowersScan}</p>}
            <p className="text-3xl font-bold my-3 text-gray-800">{followersCount ?? '-'}</p>
            <button
              className={`font-semibold px-4 py-2 rounded-md transition 
                ${selectedAction === "get-followers"
                  ? "bg-green-600 scale-105 shadow-lg"
                  : "bg-pink-600 hover:bg-pink-700"} 
                text-white`}
              onClick={() => handleSelectAction("get-followers", getFollowers)}
            >
              Scan Followers
            </button>
          </div>

          <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-6 w-64">
            <h5 className="text-xl font-semibold text-pink-600">Following</h5>
            {lastFollowingScan && <p className="mt-2 text-gray-600 text-sm">Last scanned: {lastFollowingScan}</p>}
            <p className="text-3xl font-bold my-3 text-gray-800">{followingCount ?? '-'}</p>
            <button
              className={`font-semibold px-4 py-2 rounded-md transition 
                 ${selectedAction === "get-following"
                  ? "bg-green-600 scale-105 shadow-lg"
                  : "bg-pink-600 hover:bg-pink-700"} 
                 text-white`}
              onClick={() => handleSelectAction("get-following", getFollowing)}
            >
              Scan Following
            </button>
          </div>
        </div>

        {isBotRunning && (
          <div className="flex flex-col items-center justify-center mt-6 mb-8">
            <div className="w-64 h-2 bg-gray-300 rounded-full overflow-hidden">
              <div className="h-full bg-green-500 animate-pulse w-full"></div>
            </div>
            <p className="mt-3 text-white font-medium">
              🤖 Bot is running... don’t close the window.
            </p>
          </div>
        )}

        <div className="mt-10">
          {botStatus === "success" && <div className="mt-4 text-green-600 font-semibold">✅ Bot completed successfully.</div>}
          {botStatus === "error" && <div className="mt-4 text-red-600 font-semibold">❌ Bot failed. No data was saved.</div>}
          {botStatus === "no_change" && <div className="mt-4 text-yellow-600 font-semibold">⚠️ Bot ran successfully, but no new data was saved.</div>}
        </div>

        <div className="mt-10">
          <NonFollowers
            followersCount={followersCount}
            followingCount={followingCount}
            botStatus={botStatus}
            selectedAction={selectedAction}
            handleSelectAction={handleSelectAction}
            extensionId={EXTENSION_ID}
          />
        </div>
      </div>
      <style>
        {`
          @keyframes float {
            0% { transform: translateY(0); opacity: 0.2; }
            50% { transform: translateY(-20px); opacity: 0.5; }
            100% { transform: translateY(0); opacity: 0.2; }
          }
          .animate-float {
            animation: float infinite ease-in-out;
          }
        `}
      </style>
    </div>
  );
};

export default Dashboard;