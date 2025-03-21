// src/pages/Signup.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { registerUser } from '../features/auth/authAPI';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerUser(username, password)
      alert('✅ Account created! You can now log in.');
      navigate('/login');
      
    } catch (err) {
      console.error('Signup failed', err);
      alert('⚠️ Signup failed');
    }
  };

  return (
    <form onSubmit={handleSignup} className="col-md-6 offset-md-3">
      <h2 className="mb-3">Sign Up</h2>
      <div className="mb-3">
        <input type="text" className="form-control" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="mb-3">
        <input type="password" className="form-control" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn btn-success w-100" type="submit">Register</button>
    </form>
  );
};

export default Signup;
