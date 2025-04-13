// src/App.tsx
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Profile from './pages/Profile';
import Dashboard from './pages/Dashboard';
import ChangePassword from './pages/ChangePassword';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AdSides from './components/AdSides';
import { useAppSelector } from './app/hooks';
import ForgotPassword from './pages/ForgotPassword';
import "./App.css";
import { Button } from "./components/UI/button";
import { useState } from "react";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';


function App() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);
  const [showPopup, setShowPopup] = useState(false);
  

  const handleAccept = () => {
    setShowPopup(false);
  };

  const handleDontShowAgain = () => {
    localStorage.setItem("hideRules", "true");
    setShowPopup(false);
  };

  return (
    <Router>
      <Navbar />
      <AdSides />
      <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 relative overflow-hidden py-10">
        {/* Floating background icons */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-0">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={`absolute animate-float text-white opacity-10 text-3xl`}
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
        <ToastContainer
          position="top-center"
          autoClose={6000}
          hideProgressBar={false}
          newestOnTop={true}
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
          toastClassName={() =>
            "bg-white/80 backdrop-blur-md shadow-md text-gray-800 font-medium rounded-xl px-4 py-3 border border-pink-200"
          }
          className="text-sm leading-snug tracking-wide"
          progressClassName="bg-pink-500"
          style={{ zIndex: 9999 }}
        />

        <div className="relative z-10 px-4 sm:px-6 lg:px-8">
          <Routes>
            <Route path="/" element={<Home showPopup={showPopup} setShowPopup={setShowPopup} />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          </Routes>
          <Footer onTermsClick={() => setShowPopup(true)} />

        </div>
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
              <li>The Bot is only compatible with the Extension, You can get it for free here: (link to extension).</li>
              <li>The Extension needs your cookies to utilize the bot functionality</li>
              <li>Your Credentials are safe, once cookies are used they are not stored or saved anywhere.</li>
              <li>By using this bot, you accept all associated risks, including the possibility of account restrictions or bans.</li>
              <li>The bot is currently supported by Windows and does not work on mobile devices.</li>
              <li>Due to frequent updates from Instagram, the bot may occasionally stop working properly.</li>
              <li>For bug reports or issues, please contact: <strong>erezhabani2003@gmail.com</strong></li>
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
            0% { transform: translateY(0); opacity: 0.1; }
            50% { transform: translateY(-20px); opacity: 0.3; }
            100% { transform: translateY(0); opacity: 0.1; }
          }
          .animate-float {
            animation: float infinite ease-in-out;
          }
        `}
      </style>
    </Router>
  );
}

export default App;

