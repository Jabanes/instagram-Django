import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

// Your Firebase configuration
const firebaseConfig = {
  apiKey: 'AIzaSyDbh8z1KwrrhtJj4AXCtTI30wSlMlIyCwE',
  authDomain: 'instabot-ca8d9.firebaseapp.com',
  projectId: 'instabot-ca8d9',
  storageBucket: 'instabot-ca8d9.firebasestorage.app',
  messagingSenderId: '960834199359',
  appId: '1:960834199359:web:c1c0d54fe95d17fc4d7d8a',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
