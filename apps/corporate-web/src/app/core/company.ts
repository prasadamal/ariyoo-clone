/** Facts about the company, in one place so every page and the footer agree. */
export const COMPANY = {
  name: 'Ariyoo',
  tagline: 'Apps for local answers, travel and film.',
  email: 'Ariyoo@test.com',
  address: ['Benninganahalli 11th Cross', 'Nagavarapalaya', 'Bengaluru'],
  founders: [
    { name: 'Amal Prasad', initials: 'AP' },
    { name: 'Akshay K Vijayan', initials: 'AV' },
    { name: 'Arif K', initials: 'AK' },
  ],
  // The product's own legal documents, published with the apps.
  privacyUrl: 'https://ariyoo-docs.onrender.com/privacy/ariyoo.html',
  termsUrl: 'https://ariyoo-docs.onrender.com/privacy/ariyoo-terms.html',
} as const;
