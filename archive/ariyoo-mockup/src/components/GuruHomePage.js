import React from 'react';
import './GuruHomePage.css';

const GuruHomePage = () => {
  const incomingQuestions = [
    { id: 1, text: "New query about 📍Kochi Travel!", details: "Wants to know about best seafood restaurants." },
    { id: 2, text: "Question regarding 💻 Python programming.", details: "Needs help with a list comprehension." },
    { id: 3, text: "Inquiry about 💰 Stock Market basics.", details: "Asking for beginner-friendly resources." },
  ];

  const handleAccept = (questionId) => {
    console.log(`Accepted question ID: ${questionId}`);
    // Add logic to handle accepting a question
  };

  const handleDecline = (questionId) => {
    console.log(`Declined question ID: ${questionId}`);
    // Add logic to handle declining a question
  };

  return (
    <div className="guru-home-page">
      <header className="guru-header">
        <div className="logo-area">Ariyoo (Guru)</div>
        <div className="profile-settings-link-guru">
          <a href="#profile">Profile & Settings</a>
        </div>
      </header>

      <main className="main-content-guru">
        <section className="incoming-questions-section">
          <h3>Incoming Questions (Match Requests)</h3>
          <div className="question-list-guru">
            {incomingQuestions.length > 0 ? incomingQuestions.map(q => (
              <div key={q.id} className="question-item-guru">
                <h4>{q.text}</h4>
                <p className="question-details-guru">{q.details}</p>
                <div className="question-actions-guru">
                  <button onClick={() => handleAccept(q.id)} className="btn-accept-guru">Accept</button>
                  <button onClick={() => handleDecline(q.id)} className="btn-decline-guru">Decline</button>
                </div>
              </div>
            )) : (
              <p>No new questions at the moment. We'll notify you!</p>
            )}
          </div>
        </section>

        <section className="live-chat-placeholder-guru">
          <h3>Live Chat with Seeker</h3>
          <p>Live Chat with Seeker: Typing indicator and reply box will appear here.</p>
          {/* This area will be developed for live chat */}
        </section>

        <div className="guru-dashboard-leaderboard">
          <section className="ratings-earnings-dashboard-guru">
            <h3>Ratings & Earnings Dashboard</h3>
            <div className="dashboard-item-guru">
              <p>Total Questions Answered: <span className="value-guru">0</span></p>
            </div>
            <div className="dashboard-item-guru">
              <p>Points Earned: <span className="value-guru">0</span></p>
            </div>
            <div className="dashboard-item-guru">
              <p>Redeemable Balance: <span className="value-guru">₹0</span></p>
            </div>
            {/* More stats can be added here */}
          </section>

          <section className="guru-leaderboard-placeholder">
            <h3>Guru Leaderboard</h3>
            <p>Guru Leaderboard: Top active Gurus will be listed here.</p>
            {/* This area will display the leaderboard */}
          </section>
        </div>
      </main>

      <footer className="guru-footer">
        <p>&copy; 2024 Ariyoo. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default GuruHomePage;
