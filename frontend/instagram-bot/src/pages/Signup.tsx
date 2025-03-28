import React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../app/hooks'; // Ensure useAppDispatch is being used for dispatching actions
import { register } from '../features/auth/authSlice';
import { Card, CardContent } from "../components/UI/card";
import { Button } from "../components/UI/button";

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstname] = useState('');
  const [lastName, setLastname] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const dispatch = useAppDispatch();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Dispatch the register action, which will internally call the API and handle Redux updates
      await dispatch(register({ email, password, firstName, lastName, username }));
      alert('✅ Account created! You can now log in.');
      navigate('/login');
    } catch (err: any) {
      console.error('Signup failed', err);
      if (err.response && err.response.data) {
        const errorMessages = Object.values(err.response.data).flat().join('\n');
        alert(`⚠️ Signup failed:\n${errorMessages}`);
      } else {
        alert('⚠️ Signup failed: An unknown error occurred.');
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

      <Card className="w-[90%] max-w-md p-6 rounded-2xl shadow-xl bg-white/90 backdrop-blur-md z-10">
        <CardContent>
          <h2 className="text-3xl font-bold text-center text-pink-600 mb-4">Create Account</h2>
          <p className="text-center text-gray-600 mb-6">Sign up to join InstaBot</p>
          <form onSubmit={handleSignup} className="space-y-4">
            <input
              type="text"
              placeholder="Email"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="text"
              placeholder="First Name"
              onChange={(e) => setFirstname(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="text"
              placeholder="Last Name"
              onChange={(e) => setLastname(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="text"
              placeholder="Username"
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <input
              type="password"
              placeholder="Password"
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-pink-500"
            />
            <Button type="submit" className="w-full bg-pink-600 hover:bg-pink-700 text-white font-semibold py-2 rounded-lg transition duration-200">
              Register
            </Button>
          </form>
          <p className="text-sm text-center text-gray-500 mt-4">
            Already have an account? <a href="/login" className="text-pink-600 hover:underline">Login</a>
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
};

export default Signup;
