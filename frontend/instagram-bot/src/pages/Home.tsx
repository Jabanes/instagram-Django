import React, { useEffect } from "react";
import { BookOpenIcon } from '@heroicons/react/24/solid';


interface HomeProps {
  showPopup: boolean;
  setShowPopup: React.Dispatch<React.SetStateAction<boolean>>;
}

const Home: React.FC<HomeProps> = ({ showPopup, setShowPopup }) => {
  useEffect(() => {
    const alreadyAccepted = localStorage.getItem("hideRules");
    if (alreadyAccepted !== "true") {
      setShowPopup(true);
    }
  }, [setShowPopup]);

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
          className="absolute -top-4 left-4 z-20 bg-white/90 text-pink-600 p-3 rounded-full shadow-md hover:bg-white"
        >
          <BookOpenIcon className="w-5 h-5" />
        </button>
        <p className="text-xl font-medium leading-relaxed text-white/90">
          The ultimate Instagram companion to track and manage your social circle. Automatically detect and unfollow users who don’t follow you back.
        </p>

        <div className="text-left text-white/90">
          <h2 className="text-2xl font-semibold mb-2">How it works:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Create an account on the platform.</li>
            <li>Choose an action from the dashboard.</li>
            <li>Click "Scan Followers" to fetch your most recent followers.</li>
            <li>Click "Scan Following" to fetch the list of people you follow.</li>
            <li>Log in to your Instagram account using your browser.</li>
            <li>Go to your profile and open the exstension</li>
            <li>Click "Send to" in the extension to begin the process.</li>
            <li>After both scans are complete, a new button will appear:
              ➤ "Generate Non-Followers List"
              ⚠️ Wait untill you see the notification to ensure the action was selected propely
              This will show the users that you follow but they don’t follow you back.</li>
            <li>Review and edit the list to remove anyone you <strong>don't</strong> want to unfollow.</li>
            <li>⚠️ You cannot undo individual deletions, but you can reset the list anytime.
              The reset button will regenerate the list based on your current followers/following.</li>
            <li>When you’re ready, click "Unfollow" to start unfollowing users one by one automatically.</li>
            <li>Enjoy the cleanup! 🎉</li>
          </ol>
        </div>

        <p className="text-sm font-bold text-yellow-200">
          ⚠️ Disclaimer: This tool may violate Instagram’s Terms of Service. Use at your own risk. The developer accepts no responsibility for account restrictions, bans, or other consequences resulting from use.
        </p>

        <p className="text-sm text-white/80">
        📄 Read my <a href="/privacy-policy" className="underline hover:text-white font-medium">Privacy Policy</a>.
        </p>

        <p className="text-sm text-white/80">
          🚧 InstaBot is under active development. Expect updates, improvements, and new features in the near future.
        </p>
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

export default Home;
