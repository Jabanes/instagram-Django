import { useEffect, useState } from 'react';
import axios from 'axios';
import NonFollowers from './NonFollowers';

const Dashboard = () => {
  const [step, setStep] = useState<"idle" | "waiting" | "ready">("idle");
  const [botStatus, setBotStatus] = useState<"success" | "error" | "no_change" | "">("");
  const [followersCount, setFollowersCount] = useState<number | 0>(0);
  const [followingCount, setFollowingCount] = useState<number | 0>(0);
  const [lastFollowersScan, setLastFollowersScan] = useState<string | null>(null);
  const [lastFollowingScan, setLastFollowingScan] = useState<string | null>(null);
  const [newDataDetected, setNewDataDetected] = useState(false);

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
    <div className="text-center mt-5">
      <h2>Dashboard</h2>

      <div className="d-flex justify-content-center gap-4 mt-4 flex-wrap">
        {/* Followers card */}

        <div className="card text-center shadow-sm" style={{ width: '14rem' }}>
          <div className="card-body">
            <h5 className="card-title">Followers</h5>
            {lastFollowersScan && (
              <p className="mt-2 text-muted small">
                Last scanned: {lastFollowersScan}
              </p>
            )}
            <p className="card-text fs-4">{followersCount ?? '-'}</p>
            {step === "idle" && (
              <button className="btn btn-primary btn-sm" onClick={getFollowers}>
                Scan Followers
              </button>
            )}
          </div>
        </div>


        <div className="card text-center shadow-sm" style={{ width: '14rem' }}>
          <div className="card-body">
            <h5 className="card-title">Following</h5>
            {/* Following card */}
            {lastFollowingScan && (
              <p className="mt-2 text-muted small">
                Last scanned: {lastFollowingScan}
              </p>
            )}
            <p className="card-text fs-4">{followingCount ?? '-'}</p>
            {step === "idle" && (
              <button className="btn btn-primary btn-sm" onClick={getFollowing}>
                Scan Following
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ready state */}
      <div className="mt-4">
        {step === "waiting" && (
          <>
            <button
              className="btn btn-success"
              onClick={() => {
                const proceed = window.confirm(
                  "⚠️ Make sure you are logged into Instagram and on your profile page.\nClick OK to continue."
                );
                if (proceed) {
                  handleConfirmReady();
                }
              }}
            >
              Ready
            </button>
            <br />
            <small className="text-muted">
              CLICK ONLY AFTER LOG IN AND ON PROFILE
            </small>
          </>


        )}
        {step === "ready" && <p>⏳ Bot is running...</p>}

        {/* Alerts */}
        {botStatus === "success" && (
          <div className="alert alert-success mt-4" role="alert">
            ✅ Bot completed successfully.
          </div>
        )}
        {botStatus === "error" && (
          <div className="alert alert-danger mt-4" role="alert">
            ❌ Bot failed. No data was saved.
          </div>
        )}

        {botStatus === "no_change" && (
          <div className="alert alert-warning mt-4" role="alert">
            ⚠️ Bot ran successfully, but no new data was saved.
          </div>
        )}
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
  );
};

export default Dashboard;
