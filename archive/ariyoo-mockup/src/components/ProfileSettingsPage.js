import React from 'react';
import './ProfileSettingsPage.css';

// Assume a prop `userType` would be passed in a real app: 'seeker' or 'guru'
// For this component, we'll simulate it for display purposes if needed,
// or just show all sections with notes.
const ProfileSettingsPage = ({ userType = 'guru' }) => { // Default to 'guru' to show all sections for now
  return (
    <div className="profile-settings-page">
      <header className="ps-header">
        <h2>Profile & Account Settings</h2>
      </header>

      <main className="ps-main-content">
        <section className="ps-profile-section">
          <h3>My Profile</h3>
          <div className="ps-profile-card">
            <div className="ps-profile-picture-placeholder">
              {/* Placeholder for actual image or icon */}
              <span>Profile Pic</span>
            </div>
            <div className="ps-profile-info">
              <p className="ps-user-name"><strong>Name:</strong> User Name Placeholder</p>
              <p className="ps-user-location"><strong>Location:</strong> City, Country Placeholder</p>
              <p className="ps-user-bio"><strong>Bio:</strong> User bio goes here... This is a placeholder for a short description about the user. It can be edited by the user.</p>
            </div>
          </div>
        </section>

        <section className="ps-account-settings-section">
          <h3>Account Settings</h3>
          <div className="ps-setting-item">
            <h4>Edit Name & Email</h4>
            <p><em>Placeholder:</em> Click here to update your name and email address.</p>
          </div>
          <div className="ps-setting-item">
            <h4>Change Password</h4>
            <p><em>Placeholder:</em> Click here to set a new password.</p>
          </div>
          <div className="ps-setting-item">
            <h4>Notification Preferences</h4>
            <p><em>Placeholder:</em> Manage your email and push notification settings.</p>
          </div>
        </section>

        {/* Guru-Specific Settings Section */}
        <section className="ps-guru-specific-settings">
          <h3>Guru Specific Settings</h3>
          <p className="ps-guru-note"><em>Note: This section is visible only to users registered as Gurus.</em></p>
          
          <div className="ps-setting-item">
            <h4>Preferred Topics</h4>
            <p><em>Placeholder:</em> Topics you are interested in answering questions about (e.g., Technology, Travel, Food).</p>
          </div>
          <div className="ps-setting-item">
            <h4>Areas of Expertise</h4>
            <p><em>Placeholder:</em> Specific skills or knowledge areas (e.g., React, Python, Kerala Cuisine).</p>
          </div>
          <div className="ps-setting-item">
            <h4>Earnings Dashboard</h4>
            <p><em>Placeholder:</em> View your detailed earnings, transaction history, and redemption options.</p>
          </div>
        </section>
      </main>

      <footer className="ps-footer">
        <p>&copy; 2024 Ariyoo. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default ProfileSettingsPage;
