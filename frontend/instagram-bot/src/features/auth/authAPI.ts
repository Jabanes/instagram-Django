import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../../app/firebase'; // Make sure to initialize Firebase in firebase.ts
import axios from 'axios';
import { CustomUser } from '../../models/User'; // Use the merged CustomUser type
import { getFirestore, doc, getDoc, serverTimestamp, setDoc, Timestamp } from 'firebase/firestore';
import { User as FirebaseUser } from 'firebase/auth';

const API = process.env.REACT_APP_API_BASE_URL; // replace with your backend

// Map Firebase User to Custom User (merged)
export const mapFirebaseUserToCustomUser = async (firebaseUser: FirebaseUser | null): Promise<CustomUser | null> => {
  if (!firebaseUser) return null; // Handle null input

  try {
    const db = getFirestore();
    const userDocRef = doc(db, 'users', firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);
    const userData = userDoc.exists() ? userDoc.data() : {}; // Default to empty object

    const dateJoinedTimestamp = userData?.date_joined as Timestamp | undefined;
    const lastLoginTimestamp = userData?.last_login as Timestamp | undefined;

    // **Explicitly create the object with ONLY serializable fields**
    const serializableUser: CustomUser = {
      // --- Fields from Firebase Auth (Serializable) ---
      uid: firebaseUser.uid,
      email: firebaseUser.email ?? null, // Handle potential null email
      emailVerified: firebaseUser.emailVerified,
      displayName: firebaseUser.displayName ?? null, // Handle potential null displayName

      // --- Fields from Firestore (Ensure they are serializable) ---
      username: userData?.username || (firebaseUser.email?.split('@')[0] ?? firebaseUser.uid),
      first_name: userData?.first_name || '',
      last_name: userData?.last_name || '',
      // Convert Timestamps to ISO strings
      date_joined: dateJoinedTimestamp ? dateJoinedTimestamp.toDate().toISOString() : new Date().toISOString(),
      last_login: lastLoginTimestamp ? lastLoginTimestamp.toDate().toISOString() : new Date().toISOString(),
      roles: Array.isArray(userData?.roles) ? userData.roles : ['user'], // Ensure it's an array

      // --- IMPORTANT: DO NOT ADD ...firebaseUser here ---
    };

    return serializableUser;

  } catch (error) {
    console.error('Error mapping Firebase user to custom User:', error);
    // Fallback: return basic serializable info even on Firestore error
     return {
        uid: firebaseUser.uid,
        email: firebaseUser.email ?? null,
        emailVerified: firebaseUser.emailVerified,
        displayName: firebaseUser.displayName ?? null,
        username: firebaseUser.email?.split('@')[0] ?? firebaseUser.uid,
        first_name: '',
        last_name: '',
        date_joined: new Date().toISOString(),
        last_login: new Date().toISOString(),
        roles: ['user'],
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
    if (mappedUser) {
      console.log(mappedUser.last_login);
    } else {
      console.error("Mapped user is null.");
    }
    
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
