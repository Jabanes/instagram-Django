// src/components/Navbar.tsx
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { logout } from '../features/auth/authSlice';
import { Link, useNavigate } from 'react-router-dom';

const Navbar = () => {
  const { isAuthenticated } = useAppSelector((state) => state.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();


  const NavLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className="relative after:absolute after:left-0 after:-bottom-1 after:h-[2px] after:w-0 after:bg-pink-600 after:transition-all hover:after:w-full"
    >
      {label}
    </Link>
  );

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <nav className="bg-white shadow-md border-b border-pink-200 z-20 sticky top-0">
  <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
    {/* Logo */}
    <Link to="/" className="text-2xl font-extrabold text-pink-600 tracking-tight">
      InstaBot
    </Link>

    {/* Nav Links */}
    <div className="flex gap-6 items-center text-sm font-medium text-gray-700">
      {isAuthenticated && <NavLink to="/profile" label="Profile" />}
      {isAuthenticated && <NavLink to="/dashboard" label="Dashboard" />}

      {isAuthenticated ? (
        <button
          className="bg-pink-600 hover:bg-pink-700 text-white px-4 py-2 rounded-xl transition"
          onClick={handleLogout}
        >
          Logout
        </button>
      ) : (
        <>
          <NavLink to="/login" label="Login" />
          <NavLink to="/signup" label="Sign Up" />
        </>
      )}
    </div>
  </div>
</nav>

  );
};

export default Navbar;
