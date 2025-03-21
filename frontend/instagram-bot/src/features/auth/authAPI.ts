// src/features/auth/authAPI.ts
import axios from 'axios';
import { User } from '../../models/User';

const API = 'http://127.0.0.1:8000'; // replace with your backend

export const loginUser = async (username: string, password: string) => {
  const response = await axios.post(`${API}/login`, { username, password });
  return response.data;
};

export const registerUser = async (username: string, password: string, email:string) => {
  const response = await axios.post(`${API}/register`, { username, password, email });
  return response.data;
};

export const updateUserProfile = async (updates: Partial<User & { password?: string }>) => {
  const token = localStorage.getItem('token');
  const response = await axios.put(`${API}/update-profile`, updates, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return response.data; // updated user
};