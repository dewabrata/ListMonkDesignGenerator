import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AppProvider, useApp } from './context/AppContext';
import LoginPage from './components/LoginPage';
import UploadPage from './components/UploadPage';
import ProcessingScreen from './components/ProcessingScreen';
import EditorPage from './components/EditorPage';
import AnalyticsPage from './components/AnalyticsPage';
import Navbar from './components/shared/Navbar';
import Toast from './components/shared/Toast';

// Axios default config
axios.defaults.withCredentials = true;

const AppInner = () => {
  const { currentPage, toasts, removeToast } = useApp();
  const [authChecked, setAuthChecked] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Cek status auth saat load
    axios.get('/api/auth/me')
      .then(() => setIsLoggedIn(true))
      .catch(() => setIsLoggedIn(false))
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <>
      <Navbar onLogout={() => setIsLoggedIn(false)} />

      {currentPage === 'analytics'   && <AnalyticsPage />}
      {currentPage === 'upload'      && <UploadPage />}
      {currentPage === 'processing'  && <ProcessingScreen />}
      {currentPage === 'editor'      && <EditorPage />}

      {/* Toast container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
        ))}
      </div>
    </>
  );
};

const App = () => (
  <AppProvider>
    <AppInner />
  </AppProvider>
);

export default App;
