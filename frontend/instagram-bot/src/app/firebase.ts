import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';


// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_INSTABOT_API_KEY,
  authDomain: process.env.REACT_APP_INSTABOT_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_INSTABOT_PROJECT_ID,
  storageBucket: process.env.REACT_APP_INSTABOT_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_INSTABOT_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_INSTABOT_APP_ID, // Ensure this matches the name in .env
};

localStorage.setItem('firebaseDebug', 'true');
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
