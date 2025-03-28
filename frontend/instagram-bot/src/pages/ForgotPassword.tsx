import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../app/firebase'; // 👈 path to your Firebase config
import { useNavigate } from 'react-router-dom';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('');
    setError('');

    try {
      await sendPasswordResetEmail(auth, email);
      setStatus('✅ Password reset email sent! Check your inbox.');
    } catch (err: any) {
      console.error('Password reset failed', err);
      switch (err.code) {
        case 'auth/invalid-email':
          setError('❌ Invalid email address.');
          break;
        case 'auth/user-not-found':
          setError('❌ No user found with this email.');
          break;
        default:
          setError(`❌ ${err.message}`);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white/90 backdrop-blur-md p-6 rounded-xl shadow-xl z-10">
        <h2 className="text-2xl font-bold text-center text-pink-600 mb-4">Reset Password</h2>
        <p className="text-sm text-center text-gray-600 mb-6">Enter your email to receive a reset link</p>

        {status && <div className="text-green-600 text-sm mb-4 text-center">{status}</div>}
        {error && <div className="text-red-600 text-sm mb-4 text-center">{error}</div>}

        <form onSubmit={handleReset} className="space-y-4">
          <input
            type="email"
            placeholder="Your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            required
          />
          <button
            type="submit"
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 rounded-lg transition"
          >
            Send Reset Link
          </button>
        </form>

        <button
          onClick={() => navigate('/login')}
          className="w-full text-center text-sm text-pink-500 hover:underline mt-4"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
