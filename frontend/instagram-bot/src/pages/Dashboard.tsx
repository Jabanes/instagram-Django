import { useState } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [step, setStep] = useState<"idle" | "waiting" | "ready">("idle");
  const [botStatus, setBotStatus] = useState<"success" | "error" | "">("");

  const getFollowoing = async () => {
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

      if (status === "success") {
        setBotStatus("success");
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
      const token = localStorage.getItem('token');
      const response = await axios.post(
        'http://127.0.0.1:8000/get-followers',
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

      {step === "idle" && (
        <>
        <button className="btn btn-primary" onClick={getFollowoing}>
          Scan Following
        </button>
        <span>     </span>
        <button className="btn btn-primary" onClick={getFollowers}>
          Scan Followers
        </button>
        </>
      )}
      
      {step === "waiting" && (
        <button className="btn btn-success" onClick={handleConfirmReady}>
          Ready
        </button>
      )}
      {step === "ready" && <p>⏳ Bot is running...</p>}

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
    </div>
  );
};

export default Dashboard;
