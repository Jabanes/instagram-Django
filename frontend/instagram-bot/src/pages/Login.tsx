// src/pages/Login.tsx
import { useState } from 'react';
import { useAppDispatch } from '../app/hooks';
import { login } from '../features/auth/authSlice';
import { loginUser } from '../features/auth/authAPI';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const data = await loginUser(username, password);
      dispatch(login(data.user)); // adapt this to your backend's return value
      localStorage.setItem('token', data.access);
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/dashboard');
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
    <form onSubmit={handleSubmit} className="col-md-6 offset-md-3">
      <h2 className="mb-3">Login</h2>
      <div className="mb-3">
        <input type="text" className="form-control" placeholder="Username" onChange={(e) => setUsername(e.target.value)} />
      </div>
      <div className="mb-3">
        <input type="password" className="form-control" placeholder="Password" onChange={(e) => setPassword(e.target.value)} />
      </div>
      <button className="btn btn-primary w-100" type="submit">Login</button>
    </form>
  );
}
