import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppSelector } from '../app/hooks'; // 👈 import selector
import { CustomUser } from '../models/User';
import { Card, CardContent } from "../components/UI/card";
import { Button } from "../components/UI/button";


const ChangePassword = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = useAppSelector((state) => state.auth.user) as CustomUser | null;
  const username = user?.username

  const handleVerifyCurrentPassword = async () => {
    try {
      await axios.post(
        'http://127.0.0.1:8000/login',
        { username, password: currentPassword }, // 👈 include username
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStep(2);
      setError('');
    } catch {
      setError('❌ Incorrect current password');
      console.log(user?.username);

    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setError('❌ Passwords do not match');
      return;
    }

    try {
      await axios.put(
        'http://127.0.0.1:8000/update-profile',
        { password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('✅ Password updated successfully');
      navigate('/profile');
    } catch {
      setError('❌ Failed to update password');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center px-4 relative overflow-hidden">
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
            {Math.random() > 0.5 ? "❤️" : "👤"}
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-md bg-white/90 backdrop-blur-md p-6 rounded-xl shadow-xl">
        <h2 className="text-3xl font-bold text-center text-pink-600 mb-6">Change Password</h2>

        {error && (
          <div className="bg-red-100 text-red-800 px-4 py-2 rounded-md mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        {step === 1 ? (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">Enter Current Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <button
              onClick={handleVerifyCurrentPassword}
              className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 rounded-lg transition"
            >
              Verify
            </button>
          </>
        ) : (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />

            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              className="w-full px-4 py-2 rounded-lg border border-gray-300 mb-4 focus:outline-none focus:ring-2 focus:ring-pink-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            <button
              onClick={handlePasswordChange}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-lg transition"
            >
              Save New Password
            </button>
          </>
        )}
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

export default ChangePassword;
