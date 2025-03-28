import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/storage';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: process.env.INSTABOT_API_KEY,
  authDomain: process.env.INSTABOT_AUTH_DOMAIN,
  projectId: process.env.INSTABOT_PROJECT_ID,
  storageBucket: process.env.INSTABOT_STORAGE_BUCKET,
  messagingSenderId: process.env.INSTABOT_MESSAGING_SENDER_ID,
  appId: process.env.INSTABOT_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
