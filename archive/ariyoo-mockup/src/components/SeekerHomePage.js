import React, { useState } from 'react';
import './SeekerHomePage.css';

const SeekerHomePage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    console.log('Search term submitted:', searchTerm);
    // Add actual search logic here
  };

  const handleTagClick = (tag) => {
    console.log('Tag clicked:', tag);
    // Add tag filtering logic here
  };

  const suggestedTags = ["Travel", "Food", "Tech", "Finance", "Health", "Education"];
  const popularQuestions = [
    "Best budget phones 2024?",
    "Learn Python basics in 30 days?",
    "Top tourist destinations in Kerala?",
    "How to start investing in stocks?"
  ];
  const recentConversations = [
    { q: "Best coffee shop in town?", a: "Cafe Mocha by the riverside." },
    { q: "Recommended books for web development?", a: "Eloquent JavaScript by Marijn Haverbeke." },
    { q: "Good tailor for custom suits?", a: "Check out 'Perfect Fit' downtown." }
  ];

  return (
    <div className="seeker-home-page">
      <header className="seeker-header">
        <div className="logo-area">Ariyoo (Seeker)</div>
        <div className="profile-settings-link">
          <a href="#profile">Profile & Settings</a>
        </div>
      </header>

      <section className="search-section">
        <form onSubmit={handleSearchSubmit} className="search-bar">
          <input
            type="text"
            placeholder="Where can I find the best biryani in Kochi?"
            value={searchTerm}
            onChange={handleSearchChange}
            className="search-input"
          />
          <button type="submit" className="search-button">Ask</button>
        </form>
      </section>

      <section className="suggested-tags-section">
        <h3>Suggested Tags</h3>
        <div className="tags-container">
          {suggestedTags.map(tag => (
            <button key={tag} onClick={() => handleTagClick(tag)} className="tag-button">
              {tag}
            </button>
          ))}
        </div>
      </section>

      <main className="main-content-seeker">
        <section className="chat-interface-placeholder">
          <h3>Chat Interface</h3>
          <p>AI Auto-suggest Gurus and real-time chat will appear here.</p>
          {/* This area will be developed further */}
        </section>

        <div className="feed-sections">
          <section className="popular-questions-section">
            <h3>Trending Questions</h3>
            <ul className="question-list">
              {popularQuestions.map((question, index) => (
                <li key={index} className="question-item">
                  <a href={`#question-${index}`}>{question}</a>
                </li>
              ))}
            </ul>
          </section>

          <section className="recent-conversations-section">
            <h3>Recent Conversations</h3>
            <ul className="conversation-list">
              {recentConversations.map((convo, index) => (
                <li key={index} className="conversation-item">
                  <p><strong>Q:</strong> {convo.q}</p>
                  <p><strong>A:</strong> {convo.a}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="seeker-footer">
        <p>&copy; 2024 Ariyoo. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default SeekerHomePage;
