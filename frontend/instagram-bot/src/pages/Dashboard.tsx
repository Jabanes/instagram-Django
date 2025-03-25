import { useEffect, useState } from 'react';
import axios from 'axios';
import NonFollowers from './NonFollowers';
import Confirm from "../components/Confirm"


const Dashboard = () => {
  const [step, setStep] = useState<"idle" | "waiting" | "ready">("idle");
  const [botStatus, setBotStatus] = useState<"success" | "error" | "no_change" | "">("");
  const [followersCount, setFollowersCount] = useState<number | 0>(0);
  const [followingCount, setFollowingCount] = useState<number | 0>(0);
  const [lastFollowersScan, setLastFollowersScan] = useState<string | null>(null);
  const [lastFollowingScan, setLastFollowingScan] = useState<string | null>(null);
  const [newDataDetected, setNewDataDetected] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const token = localStorage.getItem("token");

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


  useEffect(() => {
    console.log(botStatus);

  }, [botStatus])

  useEffect(() => {


    fetchStats();
  }, []);


  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('http://127.0.0.1:8000/follow-stats', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const { followers, following, last_followers_scan, last_following_scan } = response.data;

      setFollowersCount(followers);
      setFollowingCount(following);

      if (last_followers_scan) {
        const date = new Date(last_followers_scan);
        const formatted = date.toLocaleString('he-IL', {
          timeZone: 'Asia/Jerusalem',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setLastFollowersScan(formatted);
      }

      if (last_following_scan) {
        const date = new Date(last_following_scan);
        const formatted = date.toLocaleString('he-IL', {
          timeZone: 'Asia/Jerusalem',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false
        });
        setLastFollowingScan(formatted);
      }

    } catch (err) {
      console.error("Failed to fetch follow stats:", err);
    }
  };

  const getFollowing = async () => {
    setStep("waiting");
    setBotStatus("");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://127.0.0.1:8000/get-following",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { status, before_count, after_count } = response.data;

      if (status === "success" || status === "no_change") {
        if (after_count !== before_count) {
          setNewDataDetected(true);
        }

        setBotStatus(status);
        await fetchStats();
      } else {
        setBotStatus("error");
      }
      checkNewDataFlag()

    } catch (err) {
      console.error(err);
      setBotStatus("error");
    } finally {
      setStep("idle");
    }
  };

  const getFollowers = async () => {
    setStep("waiting");
    setBotStatus("");

    try {
      const token = localStorage.getItem("token");
      const response = await axios.post(
        "http://127.0.0.1:8000/get-followers",
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const { status } = response.data;

      if (status === "success") {
        setBotStatus("success");
        await fetchStats();
      } else if (status === "no_change") {
        setBotStatus("no_change");
        await fetchStats();
      } else {
        setBotStatus("error");
      }
      checkNewDataFlag()

    } catch (err) {
      console.error(err);
      setBotStatus("error");
    } finally {
      setStep("idle");
    }
  };
  const handleConfirmReady = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://127.0.0.1:8000/confirm-bot-ready',
        {},
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const { status } = response.data;
      if (status === "success") {
        setStep("ready");
      } else {
        setBotStatus("error");
      }
    } catch (err) {
      console.error(err);
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
            {step === "idle" && (
              <button className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-4 py-2 rounded-md transition" onClick={getFollowers}>
                Scan Followers
              </button>
            )}
          </div>

          <div className="bg-white/90 backdrop-blur rounded-xl shadow-xl p-6 w-64">
            <h5 className="text-xl font-semibold text-pink-600">Following</h5>
            {lastFollowingScan && <p className="mt-2 text-gray-600 text-sm">Last scanned: {lastFollowingScan}</p>}
            <p className="text-3xl font-bold my-3 text-gray-800">{followingCount ?? '-'}</p>
            {step === "idle" && (
              <button className="bg-pink-600 hover:bg-pink-700 text-white font-semibold px-4 py-2 rounded-md transition" onClick={getFollowing}>
                Scan Following
              </button>
            )}
          </div>
        </div>

        {/* Ready state */}
        <div className="mt-10">
          {step === "waiting" && (
            <>
              <button
                className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-2 rounded-md"
                onClick={() => setShowConfirm(true)}
              >
                Ready
              </button>
              <Confirm
                open={showConfirm}
                title="Are you logged into your profile?"
                message="⚠️ Make sure you are logged into Instagram and on your profile page before starting. Proceed with caution."
                confirmText="Yes, I'm on my profile"
                cancelText="Cancel"
                onConfirm={() => {
                  handleConfirmReady();
                  setShowConfirm(false);
                }}
                onCancel={() => setShowConfirm(false)}
              />
            </>
          )}
          {step === "ready" && <p className="text-white text-lg font-medium mt-4">⏳ Bot is running... DONT CLOSE / MINIMIZE THE WINDOW</p>}

          {botStatus === "success" && <div className="mt-4 text-green-600 font-semibold">✅ Bot completed successfully.</div>}
          {botStatus === "error" && <div className="mt-4 text-red-600 font-semibold">❌ Bot failed. No data was saved.</div>}
          {botStatus === "no_change" && <div className="mt-4 text-yellow-600 font-semibold">⚠️ Bot ran successfully, but no new data was saved.</div>}
        </div>

        <div className="mt-10">
          <NonFollowers
            followersCount={followersCount}
            followingCount={followingCount}
            lastFollowersScan={lastFollowersScan}
            lastFollowingScan={lastFollowingScan}
            botStatus={botStatus}
            newDataDetected={newDataDetected}
            step={step}
            setStep={setStep}
            checkNewDataFlag={checkNewDataFlag}
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
