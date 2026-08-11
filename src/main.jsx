import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

import axios from 'axios';

// Global axios response interceptor to handle token expiration/invalid errors
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 403) {
      const message = error.response.data?.message;
      if (message === 'Token tidak valid atau kadaluwarsa. Silakan masuk kembali.') {
        localStorage.clear();
        sessionStorage.clear();
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
