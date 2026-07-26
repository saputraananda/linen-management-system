import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/login.jsx';
import ValetPage from './pages/ikm/index.jsx';
import ValetDashboard from './pages/ikm/components/Dashboard.jsx';
import SerahTerima from './pages/ikm/components/SerahTerima.jsx';
import KurangKirimLinen from './pages/ikm/components/KurangKirimLinen.jsx';
import SerahTerimaGorden from './pages/ikm/components/SerahTerimaGorden.jsx';
import KurangKirimGorden from './pages/ikm/components/KurangKirimGorden.jsx';
import RSPage from './pages/rs/index.jsx';
import RSDashboard from './pages/rs/components/RS-Dashboard.jsx';
import RSSerahTerima from './pages/rs/components/RS-SerahTerima.jsx';
import RSSerahTerimaGorden from './pages/rs/components/RS-SerahTerimaGorden.jsx';
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
            <Route path="kurang-kirim-gorden" element={<KurangKirimGorden />} />
          </Route>
        </Route>

        {/* Hospital Portal protected routes */}
        <Route element={<ProtectedRoute allowedRoles={['rs']} />}>
          <Route path="/rs" element={<RSPage />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<RSDashboard />} />
            <Route path="serah-terima-linen" element={<RSSerahTerima />} />
            <Route path="serah-terima-gorden" element={<RSSerahTerimaGorden />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
