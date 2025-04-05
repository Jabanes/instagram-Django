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
import AdSides from './components/AdSides';
import { useAppSelector } from './app/hooks';
import ForgotPassword from './pages/ForgotPassword';
import "./App.css";
import { useEffect } from "react";
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
  const isAuthenticated = useAppSelector((state) => state.auth.isAuthenticated);

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
            <Route path="/" element={<Home />} />
            <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/dashboard" element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/change-password" element={<ChangePassword />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Routes>
          {/* <Footer /> */}

        </div>
      </div>

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