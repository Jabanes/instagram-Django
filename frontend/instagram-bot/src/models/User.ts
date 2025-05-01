// src/models/User.ts

/**
 * Defines the structure for the serializable user object stored in Redux state
 * and localStorage. This contains ONLY plain data types suitable for serialization.
 * It combines necessary information from Firebase Auth and Firestore profile data.
 *
 * IMPORTANT: This interface does NOT extend the original FirebaseUser type.
 */
export interface CustomUser {
  // --- Core Firebase Auth Identifiers (Serializable) ---
  uid: string;
  email: string | null; // Email can be null in Firebase Auth
  emailVerified: boolean;

  // --- Basic Profile Info (from Firebase Auth or Firestore, Serializable) ---
  displayName: string | null; // Can be null (from Firebase Auth)
  username: string; // Your custom field (Typically from Firestore or generated)
  first_name: string; // Your custom field (From Firestore)
  last_name: string; // Your custom field (From Firestore)

  // --- Timestamps (Stored as ISO 8601 strings for serialization) ---
  date_joined: string; // Your custom field (ISO String format)
  last_login: string | null; // Your custom field (ISO String format or null)

  // --- Application-Specific Data (Serializable) ---
  roles: string[]; // Your custom field (Array of role strings)

  // NOTE: photoURL has been removed as requested.
  // Other non-serializable fields from FirebaseUser are intentionally excluded.
}

// The UserMetadata interface can likely be removed entirely now.
/*
export interface UserMetadata {
  lastSignInTime: string | null;
  creationTime: string | null;
}
*/
