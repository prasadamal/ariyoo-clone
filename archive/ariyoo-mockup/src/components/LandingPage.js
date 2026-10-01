import React from 'react';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <header className="header">
        <h1 className="logo">Ariyoo</h1>
        <p className="tagline">Your Questions, Answered.</p>
      </header>
      <section className="cta-section">
        <h2>Be the First to Experience Ariyoo! Sign up now!</h2>
        <p className="form-placeholder">Google Form for early access (Kerala users) - Link Coming Soon</p>
      </section>
      <section className="coming-soon-section">
        <p>Countdown Timer: Coming Soon</p>
        <p>Social Media & FAQ: Coming Soon</p>
      </section>
    </div>
  );
};

export default LandingPage;
