import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/login.jsx';
import ValetPage from './pages/ikm/index.jsx';
import ValetDashboard from './pages/ikm/components/Dashboard.jsx';
import SerahTerima from './pages/ikm/components/SerahTerima.jsx';
import RSPage from './pages/rs/index.jsx';
import RSDashboard from './pages/rs/components/Dashboard.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/valet" element={<ValetPage />}>
          <Route index element={<ValetDashboard />} />
          <Route path="serah-terima-linen" element={<SerahTerima />} />
        </Route>
        <Route path="/rs" element={<RSPage />}>
          <Route index element={<RSDashboard />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
