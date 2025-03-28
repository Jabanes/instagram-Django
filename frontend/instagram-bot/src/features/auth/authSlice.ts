import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CustomUser } from '../../models/User'; // Import the merged CustomUser type
import { registerUser, loginUser, logoutUser, mapFirebaseUserToCustomUser } from './authAPI'; // Import necessary functions
import { AppDispatch } from '../../app/store'; // Import the AppDispatch type for dispatching actions

const storedUser = localStorage.getItem('user');

interface AuthState {
  isAuthenticated: boolean;
  user: CustomUser | null; // Use CustomUser type
}

const initialState: AuthState = {
  isAuthenticated: !!storedUser,
  user: storedUser ? JSON.parse(storedUser) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login(state, action: PayloadAction<CustomUser>) {
      state.isAuthenticated = true;
      state.user = action.payload;
      console.log(action.payload);
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      localStorage.clear();
    },
    updateUser(state, action: PayloadAction<Partial<CustomUser>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    }
  },
});

export const { login, logout, updateUser } = authSlice.actions;

// Register action
export const register = (userDetails: { email: string, password: string, firstName: string, lastName: string, username: string }) => async (dispatch: AppDispatch) => {
  try {
    // Call the API to register the user
    const userCredential = await registerUser(userDetails.email, userDetails.password, userDetails.firstName, userDetails.lastName); // Register user with Firebase
    const firebaseUser = userCredential;

    // Map the Firebase user to your custom User model
    const mappedUser = await mapFirebaseUserToCustomUser(firebaseUser);

    // Dispatch the login action with the mapped user data
    dispatch(login(mappedUser)); 

    // Store the user in localStorage
    localStorage.setItem('user', JSON.stringify(mappedUser));
    localStorage.setItem('token', await firebaseUser.getIdToken()); // Store the Firebase access token
  } catch (err: any) {
    console.error('Registration failed:', err);
    throw new Error('Registration failed');
  }
};

export default authSlice.reducer;  // Ensure this line is present, it's the default export
