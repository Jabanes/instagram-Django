import React, { useEffect, useState } from "react";
import { Button } from "../components/UI/button";
import { BookOpenIcon } from '@heroicons/react/24/solid';

const Home = () => {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const hideRulesKey = `hideRules_${token}`;
    const alreadyAccepted = localStorage.getItem(hideRulesKey);
    if (!alreadyAccepted) {
      setShowPopup(true);
    }
  }, []);

  const handleAccept = () => {
    setShowPopup(false);
  };

  const handleDontShowAgain = () => {
    const token = localStorage.getItem("token");
    if (token) {
      localStorage.setItem(`hideRules_${token}`, "true");
    }
    setShowPopup(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex flex-col items-center justify-center relative overflow-hidden px-4">
      {/* Floating icons */}
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
            {Math.random() > 0.5 ? "❤️" : "👤"}
          </div>
        ))}
      </div>

      <button
        onClick={() => setShowPopup(true)}
        className="fixed top-20 right-5 z-50 bg-white/90 text-pink-600 p-3 rounded-full shadow-md hover:bg-white"
        >
        <BookOpenIcon className="w-5 h-5" />
      </button>

      <div className="relative z-10 max-w-4xl text-center text-white space-y-8 p-6 bg-white/10 rounded-xl shadow-xl backdrop-blur">
        <h1 className="text-5xl font-extrabold drop-shadow-xl text-white">Welcome to InstaBot</h1>
        <p className="text-xl font-medium leading-relaxed text-white/90">
          The ultimate Instagram companion to track and manage your social circle. Automatically detect and unfollow users who don’t follow you back.
        </p>

        <div className="text-left text-white/90">
          <h2 className="text-2xl font-semibold mb-2">How it works:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Login to your Instagram account through the bot interface.</li>
            <li>Click "Scan Followers" to pull your latest follower list.</li>
            <li>Click "Scan Following" to collect who you're following.</li>
            <li>Generate the non-followers list and review the results.</li>
            <li>after editing the list run the script to unfollow each user from the list one by one.</li>
            <li>You will be surprised who does't follow you back, Enjoy the show !</li>

          </ol>
        </div>

        <p className="text-sm italic mt-4 text-white/90">
          ⏳ The bot simulates real human behavior to reduce the chance of detection. This process is intentionally slow. If your account has a large number of users, scanning and unfollowing may take several hours. Best run overnight.
        </p>

        <p className="text-sm font-bold text-yellow-200">
          ⚠️ Disclaimer: This tool may violate Instagram’s Terms of Service. Use at your own risk. The developer accepts no responsibility for account restrictions, bans, or other consequences resulting from use.
        </p>

        <p className="text-sm text-white/80">
          🚧 InstaBot is under active development. Expect updates, improvements, and new features in the near future.
        </p>
      </div>

      {showPopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-xl text-gray-800 relative">
            <h2 className="text-2xl font-bold text-pink-600 mb-4">Rules & Guidelines</h2>
            <p className="mb-2 text-sm">
              Please read and understand the following before using InstaBot:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm mb-4">
              <li>This bot may conflict with Instagram's terms of service.</li>
              <li>The unfollow process is intentionally slow to mimic human behavior.</li>
              <li>It is strongly recommended to run the bot overnight if you have many followers.</li>
              <li>By using this bot, you accept all risks involved including possible restrictions or bans.</li>
              <li>This tool is still in development and may contain bugs or limitations.</li>
            </ul>
            <div className="flex justify-between mt-6">
              <Button
                className="bg-gray-200 text-gray-800 hover:bg-gray-300 px-4 py-2 rounded-md"
                onClick={handleDontShowAgain}
              >
                Don’t Show Again
              </Button>
              <Button
                className="bg-pink-600 hover:bg-pink-700 text-white px-6 py-2 rounded-md"
                onClick={handleAccept}
              >
                I have read and accept
              </Button>
            </div>
          </div>
        </div>
      )}

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

export default Home;
