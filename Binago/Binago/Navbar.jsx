import React from 'react'
import { assets } from '../../assets/assets'
import { Link, useNavigate } from 'react-router-dom'
import { FaSignOutAlt } from 'react-icons/fa'

const NavBar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();

  const handleLogout = () => {
    try {
      // Clear owner and any user session artifacts
      localStorage.removeItem('owner');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Optional: clear all if you prefer
      // localStorage.clear();

      alert('You have been logged out.');
      navigate('/');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  return (
    <div className='flex items-center justify-between px-4 border-b border-gray-300 py-3 bg-white transition-all duration-300'>
      
      {/* Left: Logo + Hamburger */}
      <div className='flex items-center gap-3'>
        <Link to='/'>
          <img src={assets.logoPicture} alt="logo" className='h-9 opacity-90'/>
        </Link>
        <button
          aria-label='Toggle sidebar'
          onClick={onToggleSidebar}
          className='p-2 rounded hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500'
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" 
               fill="currentColor" className='w-6 h-6 text-gray-700'>
            <path d="M3 6h18M3 12h18M3 18h18" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Right: Logout Button */}
      <button 
        onClick={handleLogout}
        className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 transition"
      >
        <FaSignOutAlt />
        <span className="font-medium">Logout</span>
      </button>
    </div>
  )
}

export default NavBar
