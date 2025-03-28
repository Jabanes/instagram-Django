import React, { useState } from 'react';
import { useAppDispatch } from '../app/hooks';
import { login } from '../features/auth/authSlice';
import { loginUser } from '../features/auth/authAPI';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "../components/UI/card";
import { Button } from "../components/UI/button";

export default function InstagramLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');


  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await loginUser(username, password);

      // Dispatch the login action with the mapped user data
      dispatch(login(data.user));

      // Store the user and access token in localStorage
      localStorage.setItem('token', data.access);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Navigate to the dashboard after successful login
      navigate('/dashboard');
    } catch (err: any) {
      console.error('Login failed', err);
      if (err.response && err.response.data) {
        const errorMessages = Object.values(err.response.data).flat().join('\n');
        alert(`⚠️ Login failed:\n${errorMessages}`);
      } else {
        alert('⚠️ Login failed: An unknown error occurred.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex items-center justify-center relative overflow-hidden">
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
            {Math.random() > 0.5 ? '❤️' : '👤'}
          </div>
        ))}
      </div>

      <Card className="w-[90%] max-w-sm p-6 rounded-2xl shadow-xl bg-white/90 backdrop-blur-md z-10">
        <CardContent>
          <h2 className="text-3xl font-bold text-center text-pink-600 mb-4">Welcome Back</h2>
          <p className="text-center text-gray-600 mb-6">Login to your InstaBot account</p>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Email"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 rounded-lg transition duration-200">
              Login
            </Button>
          </form>
          <p className="text-sm text-center text-gray-500 mt-4">
            Don’t have an account? <a href="/signup" className="text-pink-600 hover:underline">Sign up</a>
          </p>
          <p className="text-sm text-center text-gray-500 mt-1">
            <a href="/forgot-password" className="text-pink-600 hover:underline">Forgot password?</a>
          </p>
        </CardContent>
      </Card>

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
