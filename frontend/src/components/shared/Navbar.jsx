import React from 'react';
import axios from 'axios';
import { useApp } from '../../context/AppContext';

const Navbar = ({ onLogout }) => {
  const { currentPage, navigateTo } = useApp();

  const isAnalytics = currentPage === 'analytics';
  const isDesign = ['upload', 'processing', 'editor'].includes(currentPage);

  const handleLogout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch {
      // ignore errors
    }
    onLogout();
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-40 bg-surface-900 border-b border-surface-800 h-12 flex items-center px-4 gap-2">
      {/* Brand */}
      <span className="text-brand-400 font-semibold text-sm mr-4 select-none">
        Listmonk Design
      </span>

      {/* Tabs */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigateTo('analytics')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isAnalytics
              ? 'bg-brand-600 text-white'
              : 'text-surface-300 hover:text-white hover:bg-surface-800'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Analytics
        </button>

        <button
          onClick={() => navigateTo('upload')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            isDesign
              ? 'bg-brand-600 text-white'
              : 'text-surface-300 hover:text-white hover:bg-surface-800'
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Design
        </button>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-surface-300 hover:text-white hover:bg-surface-800 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Logout
      </button>
    </nav>
  );
};

export default Navbar;
