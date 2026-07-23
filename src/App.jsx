import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/login.jsx';
import ValetPage from './pages/ikm/index.jsx';
import ValetDashboard from './pages/ikm/components/Dashboard.jsx';
import SerahTerima from './pages/ikm/components/SerahTerima.jsx';
import KurangKirimLinen from './pages/ikm/components/KurangKirimLinen.jsx';
import SerahTerimaGorden from './pages/ikm/components/SerahTerimaGorden.jsx';
import RSPage from './pages/rs/index.jsx';
import RSDashboard from './pages/rs/components/Dashboard.jsx';
import { ProtectedRoute, GuestRoute } from './components/RouteGuards.jsx';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Guest routes (locked when logged in) */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
        </Route>
        
        {/* Valet Portal protected routes */}
        <Route element={<ProtectedRoute allowedRoles={['valet']} />}>
          <Route path="/valet" element={<ValetPage />}>
            <Route index element={<ValetDashboard />} />
            <Route path="serah-terima-linen" element={<SerahTerima />} />
            <Route path="kurang-kirim-linen" element={<KurangKirimLinen />} />
            <Route path="serah-terima-gorden" element={<SerahTerimaGorden />} />
          </Route>
        </Route>

        {/* Hospital Portal protected routes */}
        <Route element={<ProtectedRoute allowedRoles={['rs']} />}>
          <Route path="/rs" element={<RSPage />}>
            <Route index element={<RSDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
