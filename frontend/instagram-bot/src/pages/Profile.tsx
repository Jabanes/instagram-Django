import { useState } from 'react'; import { useAppSelector, useAppDispatch } from '../app/hooks';
import { User } from '../models/User';
import { FaPencilAlt } from 'react-icons/fa';
import { updateUserProfile } from '../features/auth/authAPI';
import { updateUser } from '../features/auth/authSlice';
import { IconBaseProps } from 'react-icons';

const PencilIcon = FaPencilAlt as React.FC<IconBaseProps>;

const Profile = () => {
  const user = useAppSelector((state) => state.auth.user) as User | null;
  const dispatch = useAppDispatch();

  const [editing, setEditing] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState<string>('');

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
    field: keyof User | 'password',
    isPassword = false
  ) => (
    <li className="list-group-item">
      <div className="row align-items-center">
        <div className="col-4 fw-bold">{label}:</div>

        <div className="col-6 text-center">
          {editing === field ? (
            field === 'password' ? (
              <a href="/change-password" className="btn btn-link p-0">
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
              {isPassword ? '••••••••' : user[field as keyof User] || 'N/A'}
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
              <div className="d-flex gap-2 justify-content-end">
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
                  isPassword ? '' : user[field as keyof User]?.toString()
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

  return (
    <div className="d-flex justify-content-center mt-5">
      <div className="card shadow-sm" style={{ width: '30rem' }}>
        <div className="card-body">
          <h3 className="card-title text-center mb-4">
            {user.first_name || user.username}'s Profile
          </h3>
          <ul className="list-group list-group-flush">
            {renderRow('Username', 'username')}
            {renderRow('Email', 'email')}
            {renderRow('First Name', 'first_name')}
            {renderRow('Last Name', 'last_name')}
            {renderRow('Password', 'password', true)}

            {/* Static info rows in same layout */}
            <li className="list-group-item">
              <div className="row align-items-center">
                <div className="col-4 fw-bold">Date Joined:</div>
                <div className="col-6 text-center">
                  {user.date_joined}
                </div>
              </div>
            </li>
            <li className="list-group-item">
              <div className="row align-items-center">
                <div className="col-4 fw-bold">Last Login:</div>
                <div className="col-6 text-center">
                {user.last_login ? user.last_login : 'Never'}
                </div>
              </div>
            </li>
            <li className="list-group-item">
              <div className="row align-items-center">
                <div className="col-4 fw-bold">Roles:</div>
                <div className="col-6 text-center">
                  {user.roles.length > 0 ? user.roles.join(', ') : 'None'}
                </div>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Profile;