import { useEffect, useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [step, setStep] = useState<"idle" | "waiting" | "ready">("idle");
  const [botStatus, setBotStatus] = useState<"success" | "error" | "no_change" | "">("");
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [lastFollowersScan, setLastFollowersScan] = useState<string | null>(null);
  const [lastFollowingScan, setLastFollowingScan] = useState<string | null>(null);



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
          Authorization: `Bearer ${token}`
        }
      });

      setFollowersCount(response.data.followers);
      setFollowingCount(response.data.following);
    } catch (err) {
      console.error("Failed to fetch follow stats:", err);
    }
  };

  const getFollowing = async () => {
    setStep("waiting");
    setBotStatus("");
  
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://127.0.0.1:8000/get-following',
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
  
      const { status } = response.data;
  
      const israelTime = new Date().toLocaleString('he-IL', {
        timeZone: 'Asia/Jerusalem',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
  
      if (status === "success") {
        setBotStatus("success");
        setLastFollowingScan(israelTime);
        await fetchStats(); // Re-fetch updated following count
      } else if (status === "no_change") {
        setBotStatus("no_change");
        setLastFollowingScan(israelTime); // Optional: still update last scan time
      } else {
        setBotStatus("error");
      }
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
        const israelTime = new Date().toLocaleString("he-IL", {
          timeZone: "Asia/Jerusalem",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });

        setBotStatus("success");
        setLastFollowersScan(israelTime);
        await fetchStats();
      } else if (status === "no_change") {
        setBotStatus("no_change");
      } else {
        setBotStatus("error");
      }
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

      </div>
    </div>
  );
};

export default Dashboard;
