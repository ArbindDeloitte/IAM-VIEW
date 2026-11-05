import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import App from './App.jsx';
import Dpdp from './Dpdp.jsx';

export default function Layout() {
  return (
    <div className="shell">
      <nav className="nav">
        <span className="brand">IAM Navigator</span>
        <NavLink to="/" end className="navlink">Controls explorer</NavLink>
        <NavLink to="/dpdp" className="navlink">DPDP Act: where IAM fits</NavLink>
      </nav>
      <main className="page">
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dpdp" element={<Dpdp />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
