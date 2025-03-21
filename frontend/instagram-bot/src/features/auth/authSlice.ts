// src/features/auth/authSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { User } from '../../models/User';

const storedUser = localStorage.getItem('user');

interface AuthState {
  isAuthenticated: boolean;
  user: User  | null;
}

const initialState: AuthState = {
  isAuthenticated: !!storedUser,
  user: storedUser ? JSON.parse(storedUser) : null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login(state, action: PayloadAction<User>) {
      state.isAuthenticated = true;
      state.user = action.payload;
      console.log(action.payload);
      
    },
    logout(state) {
      state.isAuthenticated = false;
      state.user = null;
      localStorage.clear();
    },
    
    updateUser(state, action: PayloadAction<Partial<User>>) {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
      }
    }
  },
});

export const { login, logout, updateUser} = authSlice.actions;

export default authSlice.reducer;
