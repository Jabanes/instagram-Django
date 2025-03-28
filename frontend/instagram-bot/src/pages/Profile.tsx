import { useState } from 'react'; import { useAppSelector, useAppDispatch } from '../app/hooks';
import { CustomUser } from '../models/User';
import { FaPencilAlt } from 'react-icons/fa';
import { updateUserProfile } from '../features/auth/authAPI';
import { updateUser } from '../features/auth/authSlice';
import { IconBaseProps } from 'react-icons';
import { User as FirebaseUser, UserMetadata } from 'firebase/auth';

const PencilIcon = FaPencilAlt as React.FC<IconBaseProps>;

const Profile = () => {
  const user = useAppSelector((state) => state.auth.user) as CustomUser | null;
  const dispatch = useAppDispatch();

  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

  const formatTimestamp = (ts: any) => {
    return ts?.seconds ? new Date(ts.seconds * 1000).toLocaleString() : 'N/A';
  };

  if (!user) return null;

  const handleEditClick = (field: string, value: string | undefined) => {
    setEditing(field);
    setInputValue(value || '');
  };

  const handleSave = async () => {
    if (!editing) return;
    try {
      const update = { [editing]: inputValue };
      const updatedUser = await updateUserProfile(update);
      dispatch(updateUser(update));
      setEditing(null);
      setInputValue('');
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
  
  const renderRow = (
    label: string,
    field: keyof CustomUser | 'password',
    isPassword = false
  ) => (
    <li className="list-group-item">
      <div className="py-3 flex justify-between items-center">
        <div className="col-4 fw-bold">{label}:</div>
  
        <div className="col-6 text-center">
          {editing === field ? (
            field === 'password' ? (
              <a href="/change-password" className="text-blue-600 hover:underline font-medium">
                Change Password
              </a>
            ) : (
              <input
                type={isPassword ? 'password' : 'text'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="form-control form-control-sm"
              />
            )
          ) : (
            <span>
              {isPassword ? '••••••••' : renderUserField(user[field as keyof CustomUser])}
            </span>
          )}
        </div>
  
        <div className="col-2 text-end">
          {editing === field ? (
            field === 'password' ? (
              <button
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
            ) : (
              <div className="flex gap-6 justify-end">
                <button className="btn btn-sm btn-primary" onClick={handleSave}>
                  Save
                </button>
                <button
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            )
          ) : (
            <span
              style={{ cursor: 'pointer' }}
              onClick={() =>
                handleEditClick(
                  field,
                  isPassword ? '' : user[field as keyof CustomUser]?.toString() || ''
                )
              }
            >
              <PencilIcon />
            </span>
          )}
        </div>
      </div>
    </li>
  );

  const renderUserField = (value: any) => {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    if (value instanceof Date) return value.toISOString();
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString(); // 🔥 Fix timestamp
    if (value?.lastSignInTime) return `Last sign-in: ${value.lastSignInTime}`;
    return value ? value.toString() : 'N/A';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 flex justify-center py-16 px-4 relative overflow-hidden">
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
  
    <div className="relative z-10 bg-white/90 backdrop-blur-lg rounded-xl shadow-xl w-full max-w-2xl px-6 py-8">
      <h3 className="text-2xl font-bold text-pink-600 text-center mb-6">
        {user.first_name || user.username}'s Profile
      </h3>
      <ul className="divide-y divide-gray-200">
        {/* Repeat this for each row */}
        {renderRow('Username', 'username')}
        {renderRow('Email', 'email')}
        {renderRow('First Name', 'first_name')}
        {renderRow('Last Name', 'last_name')}
        {renderRow('Password', 'password', true)}
  
        <li className="py-3 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Date Joined:</span>
          <span className="text-gray-800">{formatTimestamp(user.date_joined)}</span>

        </li>
        <li className="py-3 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Last Login:</span>
          <span className="text-gray-800">{formatTimestamp(user.last_login)}</span>
        </li>
        <li className="py-3 flex justify-between items-center">
          <span className="font-semibold text-gray-700">Roles:</span>
          <span className="text-gray-800">{user.roles.length > 0 ? user.roles.join(', ') : 'None'}</span>
        </li>
      </ul>
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

export default Profile;