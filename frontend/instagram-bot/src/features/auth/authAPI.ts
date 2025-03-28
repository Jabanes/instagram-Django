import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../app/firebase'; // Make sure to initialize Firebase in firebase.ts
import axios from 'axios';
import { CustomUser } from '../../models/User'; // Use the merged CustomUser type
import { getFirestore, doc, getDoc, serverTimestamp, setDoc  } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

const API = 'http://127.0.0.1:8000'; // replace with your backend

// Map Firebase User to Custom User (merged)
export const mapFirebaseUserToCustomUser = async (firebaseUser: FirebaseUser): Promise<CustomUser> => {
  try {
    const db = getFirestore();
    const userDocRef = doc(db, 'users', firebaseUser.uid); // Assuming user data is stored in Firestore
    const userDoc = await getDoc(userDocRef);

    const userData = userDoc.exists() ? userDoc.data() : null;

    // Return the merged user data, combining Firebase data with custom fields
    return {
      ...firebaseUser, // Merge all Firebase fields
      username: userData?.username || '', // Custom field (username)
      email: firebaseUser.email || '',
      first_name: userData?.first_name || '',
      last_name: userData?.last_name || '',
      last_login: new Date().toISOString(), // Or set a proper date if available
      date_joined: userData?.date_joined || new Date().toISOString(), // Firestore date or current date
      roles: userData?.roles || [], // Roles can be an array
    };
  } catch (error) {
    // In case of an error, return a default or empty CustomUser object
    console.error('Error mapping Firebase user to custom User:', error);
    return {
      ...firebaseUser, // If error, still return the FirebaseUser object with empty custom fields
      username: '',
      email: firebaseUser.email || '',
      first_name: '',
      last_name: '',
      last_login: null,
      date_joined: new Date().toISOString(),
      roles: [],
    };
  }
};

// Register function
export const registerUser = async (
  email: string,
  password: string,
  first_name: string,
  last_name: string
) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    const db = getFirestore();
    const uid = user.uid;
    const username = email.split("@")[0];

    // Store user profile in Firestore
    await setDoc(doc(db, "users", uid), {
      email,
      username,
      first_name,
      last_name,
      date_joined: serverTimestamp(),
      last_login: serverTimestamp(),
      roles: ["user"],
    });

    return user;
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const loginUser = async (email: string, password: string) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    const mappedUser = await mapFirebaseUserToCustomUser(firebaseUser);
    const token = await firebaseUser.getIdToken();

    return { user: mappedUser, access: token };
  } catch (error: any) {
    throw error;
  }
};

// Logout function
export const logoutUser = async () => {
  try {
    await signOut(auth);
  } catch (error: any) {
    throw new Error(error.message);
  }
};

export const updateUserProfile = async (
  updates: Partial<CustomUser & { password?: string }>
) => {
  const firebaseUser = auth.currentUser;
  if (!firebaseUser) throw new Error("No authenticated user found.");

  const token = await firebaseUser.getIdToken();

  const response = await axios.put(`${API}/update-profile`, updates, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};
