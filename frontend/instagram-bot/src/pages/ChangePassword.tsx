import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAppSelector } from '../app/hooks'; // 👈 import selector
import { User } from '../models/User';

const ChangePassword = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = localStorage.getItem('token');
  const user = useAppSelector((state) => state.auth.user) as User | null;
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
    <div className="col-md-6 offset-md-3 mt-5">
      <h2 className="text-center mb-4">Change Password</h2>
      {error && <div className="alert alert-danger">{error}</div>}
      {step === 1 ? (
        <>
          <label className="form-label">Enter Current Password</label>
          <input
            type="password"
            className="form-control mb-3"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <button className="btn btn-primary w-100" onClick={handleVerifyCurrentPassword}>
            Verify
          </button>
        </>
      ) : (
        <>
          <label className="form-label">New Password</label>
          <input
            type="password"
            className="form-control mb-3"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <label className="form-label">Confirm Password</label>
          <input
            type="password"
            className="form-control mb-3"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
          <button className="btn btn-success w-100" onClick={handlePasswordChange}>
            Save New Password
          </button>
        </>
      )}
    </div>
  );
};

export default ChangePassword;
