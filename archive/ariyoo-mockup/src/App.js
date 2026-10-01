import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';

// Import Page Components
import LandingPage from './components/LandingPage';
import SignUpPage from './components/SignUpPage';
import LoginPage from './components/LoginPage';
import SeekerHomePage from './components/SeekerHomePage';
import GuruHomePage from './components/GuruHomePage';
import ProfileSettingsPage from './components/ProfileSettingsPage';

function App() {
  return (
    <Router>
      <div className="App">
        <nav className="main-nav">
          <ul>
            <li><Link to="/">Home (Landing)</Link></li>
            <li><Link to="/signup">Sign Up</Link></li>
            <li><Link to="/login">Login</Link></li>
            <li><Link to="/seeker-home">Seeker Home</Link></li>
            <li><Link to="/guru-home">Guru Home</Link></li>
            <li><Link to="/profile">Profile & Settings</Link></li>
          </ul>
        </nav>

        <hr />

        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignUpPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/seeker-home" element={<SeekerHomePage />} />
          <Route path="/guru-home" element={<GuruHomePage />} />
          <Route path="/profile" element={<ProfileSettingsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
