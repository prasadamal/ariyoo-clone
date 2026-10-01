import React, { useState } from 'react';
import './SignUpPage.css';

const SignUpPage = () => {
  const [userType, setUserType] = useState('seeker'); // 'seeker' or 'guru'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    language: 'english',
    inviteCode: '',
    phone: '',
  });
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleUserTypeChange = (event) => {
    setUserType(event.target.value);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prevState => ({
      ...prevState,
      [name]: value,
    }));
  };

  const handleTermsChange = (event) => {
    setTermsAccepted(event.target.checked);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    // Basic validation
    if (!termsAccepted) {
      alert('Please accept the Terms & Conditions.');
      return;
    }
    if (userType === 'guru' && !formData.phone) {
      alert('Phone number is required for Gurus.');
      return;
    }
    console.log('Form data submitted:', { userType, ...formData, termsAccepted });
    // Add actual sign-up logic here
  };

  return (
    <div className="signup-page">
      <h2>Create Your Ariyoo Account</h2>
      <div className="user-type-selection">
        <label>
          <input
            type="radio"
            value="seeker"
            checked={userType === 'seeker'}
            onChange={handleUserTypeChange}
            name="userType"
          />
          Sign up as Seeker
        </label>
        <label>
          <input
            type="radio"
            value="guru"
            checked={userType === 'guru'}
            onChange={handleUserTypeChange}
            name="userType"
          />
          Sign up as Guru
        </label>
      </div>

      <form onSubmit={handleSubmit} className="signup-form">
        <div className="form-group">
          <label htmlFor="name">Name:</label>
          <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required />
        </div>
        <div className="form-group">
          <label htmlFor="language">Language Preference:</label>
          <select id="language" name="language" value={formData.language} onChange={handleChange}>
            <option value="english">English</option>
            <option value="malayalam">Malayalam</option>
            {/* Add other languages as needed */}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="inviteCode">Invite Code (Optional):</label>
          <input type="text" id="inviteCode" name="inviteCode" value={formData.inviteCode} onChange={handleChange} />
        </div>

        {userType === 'guru' && (
          <div className="form-group">
            <label htmlFor="phone">Phone:</label>
            <input type="tel" id="phone" name="phone" value={formData.phone} onChange={handleChange} required={userType === 'guru'} />
          </div>
        )}

        <div className="form-group terms-group">
          <input type="checkbox" id="terms" checked={termsAccepted} onChange={handleTermsChange} />
          <label htmlFor="terms">I accept the Terms & Conditions</label>
        </div>

        <button type="submit" className="btn btn-signup" disabled={!termsAccepted}>Sign Up</button>
      </form>

      <div className="social-signup">
        <p>OR</p>
        <button type="button" className="btn btn-google">Sign in with Google</button>
      </div>
    </div>
  );
};

export default SignUpPage;
