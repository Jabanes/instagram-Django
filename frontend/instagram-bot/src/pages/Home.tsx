import React, { useEffect, useState } from "react";
import { Button } from "../components/UI/button";
import { BookOpenIcon } from '@heroicons/react/24/solid';

const Home = () => {
  const [showPopup, setShowPopup] = useState(false);

  useEffect(() => {
    const alreadyAccepted = localStorage.getItem("hideRules");
    if (alreadyAccepted !== "true") {
      setShowPopup(true);
    }
  }, []);

  const handleAccept = () => {
    setShowPopup(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem("hideRules", "true");
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



      <div className="relative z-10 max-w-4xl mx-auto text-center text-white space-y-8 p-6 bg-white/10 rounded-xl shadow-xl backdrop-blur">
        <h1 className="text-5xl font-extrabold drop-shadow-xl text-white">Welcome to InstaBot</h1>
        <button
          onClick={() => setShowPopup(true)}
          className="absolute -top-4 left-4 z-20 bg-white/90 text-pink-600 p-3 rounded-full shadow-md hover:bg-white">
          <BookOpenIcon className="w-5 h-5" />
        </button>
        <p className="text-xl font-medium leading-relaxed text-white/90">
          The ultimate Instagram companion to track and manage your social circle. Automatically detect and unfollow users who don’t follow you back.
        </p>

        <div className="text-left text-white/90">
          <h2 className="text-2xl font-semibold mb-2">How it works:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Create an account on the platform.</li>
            <li>Choose an action from the dashboard.

              ⚠️ You will need to log in to your Instagram account manually each time you choose an action</li>
            <li>Click "Scan Followers" to fetch your most recent followers.</li>
            <li>Click "Scan Following" to fetch the list of people you follow.</li>
            <li>Once logged in and on your Instagram profile page, click "Ready" to begin the scan.</li>
            <li>After both scans are complete, a new button will appear:
              ➤ "Generate Non-Followers List"
              This will show users you follow who don’t follow you back.</li>
            <li>Review and edit the list to remove anyone you don't want to unfollow.</li>
            <li>you can edit the list to exclude and ignore users that YOU DONT WANT TO UNFOLLOW.</li>
            <li>⚠️ You cannot undo individual deletions, but you can reset the list anytime.
              The reset button will regenerate the list based on your current followers/following.</li>
            <li>When you’re ready, click "Unfollow" to start unfollowing users one by one automatically.</li>
            <li>You might be surprised who’s not following you back...
              Enjoy the cleanup! 🎉</li>

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
            <strong>Please read and understand the following before using InstaBot:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm mb-4">
              <li>This bot may violate Instagram's Terms of Service. Use at your own risk.</li>
              <li>The unfollow / scan process is intentionally slow to mimic human behavior and avoid detection.</li>
              <li>If you have a large number of followings / followers, it's recommended to run the bot overnight.</li>
              <li>By using this bot, you accept all associated risks, including the possibility of account restrictions or bans.</li>
              <li>The bot is currently supported only on Windows and does not work on mobile devices.</li>
              <li>Due to frequent updates from Instagram, the bot may occasionally stop working properly.</li>
              <li>For bug reports or issues, please contact: <strong>jabanes3535@gmail.com</strong></li>
              <li>This tool is built by a solo developer and is still under active development — bugs and limitations are to be expected.</li>
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
