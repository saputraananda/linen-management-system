import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/login.jsx';
import ValetPage from './pages/ikm/index.jsx';
import ValetDashboard from './pages/ikm/components/Dashboard.jsx';
import SerahTerima from './pages/ikm/components/SerahTerima.jsx';
import KurangKirimLinen from './pages/ikm/components/KurangKirimLinen.jsx';
import SerahTerimaKomersil from './pages/ikm/components/SerahTerimaKomersil.jsx';
import KurangKirimKomersil from './pages/ikm/components/KurangKirimKomersil.jsx';
import RSPage from './pages/rs/index.jsx';
import RSDashboard from './pages/rs/components/RS-Dashboard.jsx';
import RSSerahTerima from './pages/rs/components/RS-SerahTerima.jsx';
import RSSerahTerimaKomersil from './pages/rs/components/RS-SerahTerimaKomersil.jsx';
// import RSKurangKirimKomersil from './pages/rs/components/RS-KurangKirimKomersil.jsx';
import { ProtectedRoute, GuestRoute } from './components/RouteGuards.jsx';
import UnitPage from './pages/unit/index.jsx';
import UnitDashboard from './pages/unit/components/Unit-Dashboard.jsx';

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
            <Route path="serah-terima-komersil" element={<SerahTerimaKomersil />} />
            <Route path="kurang-kirim-komersil" element={<KurangKirimKomersil />} />
          </Route>
        </Route>

        {/* Hospital Portal protected routes */}
        <Route element={<ProtectedRoute allowedRoles={['rs']} />}>
          <Route path="/rs" element={<RSPage />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<RSDashboard />} />
            <Route path="serah-terima-linen" element={<RSSerahTerima />} />
            <Route path="serah-terima-komersil" element={<RSSerahTerimaKomersil />} />
            {/* <Route path="kurang-kirim-komersil" element={<RSKurangKirimKomersil />} /> */}
          </Route>
        </Route>

        {/* Hospital Unit Portal protected routes */}
        <Route element={<ProtectedRoute allowedRoles={['unit']} />}>
          <Route path="/unit" element={<UnitPage />}>
            <Route index element={<UnitDashboard />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
