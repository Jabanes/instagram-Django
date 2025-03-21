// src/components/Navbar.tsx
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <nav className="navbar navbar-expand-lg navbar-dark bg-dark">
      <div className="container">
        <Link className="navbar-brand" to="/">InstaBot</Link>
        <div className="collapse navbar-collapse">
          <ul className="navbar-nav me-auto">
            <li className="nav-item"><Link className="nav-link" to="/">Home</Link></li>
            {isAuthenticated && <li className="nav-item"><Link className="nav-link" to="/profile">Profile</Link></li>}
            {isAuthenticated && <li className="nav-item"><Link className="nav-link" to="/dashboard">Dashboard</Link></li>}
          </ul>
          <ul className="navbar-nav ms-auto">
            {isAuthenticated ? (
              <li className="nav-item"><button className="btn btn-outline-light" onClick={handleLogout}>Logout</button></li>
            ) : (
              <>
                <li className="nav-item"><Link className="nav-link" to="/login">Login</Link></li>
                <li className="nav-item"><Link className="nav-link" to="/signup">Sign Up</Link></li>
              </>
            )}
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
