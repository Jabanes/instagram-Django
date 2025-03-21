// src/pages/Signup.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { registerUser } from '../features/auth/authAPI';

const Signup = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registerUser(username, password, email)
      alert('✅ Account created! You can now log in.');
      navigate('/login');
      
    } catch (err: any) {
      console.error('Signup failed', err);
  
      // If the error has a response (from Django), display the message
      if (err.response && err.response.data) {
        const errorData = err.response.data;
  
        // Collect all error messages into one string
        const errorMessages = Object.values(errorData)
          .flat()
          .join('\n');
  
        alert(`⚠️ Signup failed:\n${errorMessages}`);
      } else {
        alert('⚠️ Signup failed: An unknown error occurred.');
      }
    }
  };

  return (
    <form onSubmit={handleSignup} className="col-md-6 offset-md-3">
      <h2 className="mb-3">Sign Up</h2>
      <div className="mb-3">
        <input type="text" className="form-control" placeholder="Email" onChange={(e) => setEmail(e.target.value)} />
      </div>
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
