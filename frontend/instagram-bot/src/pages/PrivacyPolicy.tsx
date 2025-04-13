import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function PrivacyPolicy() {
  const [accepted, setAccepted] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isAccepted = localStorage.getItem("acceptedPrivacy");
    if (isAccepted === "true") setAccepted(true);
  }, []);

  const handleAccept = () => {
    localStorage.setItem("acceptedPrivacy", "true");
    setAccepted(true);
    toast.success("✅ Cookies will now be used by the extension.", {
        position: "top-center",
        autoClose: 4000,
        theme: "colored",
      });
    navigate("/"); // go back to Home page
  };


  const handleRevoke = () => {
    localStorage.removeItem("acceptedPrivacy");
    setAccepted(false);
    
    toast.info("🚫 Cookies are no longer used by the extension.", {
        position: "top-center",
        autoClose: 4000,
        theme: "colored",
    });

    // 🔁 Tell the extension to forget consent if it's running
    if (chrome?.storage?.local) {
      chrome.storage.local.remove("cookieConsent", () => {
        console.log("🔁 Extension consent revoked.");
      });
    }
}

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center relative overflow-hidden px-4">
      {/* floating icons */}
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

      {/* container */}
      <div className="relative z-10 max-w-3xl mx-auto p-8 bg-white/10 backdrop-blur rounded-xl shadow-xl text-white space-y-6">
        <h1 className="text-4xl font-bold text-white">📜 Privacy Policy</h1>

        <p className="text-sm leading-relaxed text-white/90">
          This extension collects Instagram session cookies only when you manually approve it via the browser extension popup. These cookies are used solely to automate Instagram actions on your behalf.
        </p>
        <p className="text-sm leading-relaxed text-white/90">
          No data is shared with third parties. Your session cookies are only used temporarily and sent securely to your private backend.
        </p>
        <p className="text-sm leading-relaxed text-white/90">
          By continuing, you acknowledge these terms and accept responsibility for automation-related risks.
        </p>

        <p className="text-xs text-white/60 italic">
          Last updated: {new Date().toLocaleDateString()}
        </p>

        <div className="mt-6 text-center">
          {!accepted ? (
            <button
              onClick={handleAccept}
              className="bg-white text-pink-600 hover:bg-red-100 px-6 py-2 rounded-lg font-semibold border border-pink-500"
            >
              ✅ I Accept
            </button>
          ) : (
            <button
              onClick={handleRevoke}
              className="bg-white text-pink-600 hover:bg-red-100 px-6 py-2 rounded-lg font-semibold border border-pink-500"
            >
              🚫 Don’t use my cookies anymore
            </button>
          )}
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
}
