// src/models/User.ts (Updated or New Merged Type)
import { User as FirebaseUser } from 'firebase/auth';

// src/models/User.ts
export interface UserMetadata {
  lastSignInTime: string | null;
  creationTime: string | null;
}

export interface CustomUser extends FirebaseUser {
  username: string;
  first_name: string;
  last_name: string;
  last_login: string | null;
  date_joined: string;
  roles: string[]; // Adjust if roles are objects instead of strings
}
