import { create } from 'zustand';
import { getUser } from '../utils/database/users';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { User } from '../utils/database/types';

type AuthState = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
  clearError: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  error: null,

  clearError: () => set({ error: null }),

  initialize: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const storedUser = await AsyncStorage.getItem('user');
      if (storedUser) {
        const user = JSON.parse(storedUser);
        set({ user, isAuthenticated: true });
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
      await AsyncStorage.removeItem('user');
      set({ error: 'Failed to restore session' });
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (username: string, password: string) => {
    try {
      set({ isLoading: true, error: null });
      
      if (!username.trim() || !password.trim()) {
        throw new Error('Username and password are required');
      }

      const userData = await getUser(username.toLowerCase().trim(), password.trim());
      
      if (!userData) {
        throw new Error('Invalid credentials');
      }

      if (!userData.active) {
        throw new Error('Your account has been deactivated. Please contact an administrator.');
      }

      // Store user info without sensitive data
      const userInfo = {
        id: userData.id,
        username: userData.username,
        isAdmin: Boolean(userData.isAdmin),
        active: userData.active,
        roles: userData.roles || [],
        companies: userData.companies || []
      };

      // Clear any existing data before setting new user
      await AsyncStorage.clear();
      await AsyncStorage.setItem('user', JSON.stringify(userInfo));
      
      set({ 
        user: userInfo,
        isAuthenticated: true,
        error: null
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      set({ error: errorMessage });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      
      // Clear all storage
      await AsyncStorage.clear();
      
      // Reset store state
      set({ 
        user: null,
        isAuthenticated: false,
        error: null,
        isLoading: false
      });
      
      if (Platform.OS === 'web') {
        window.location.reload();
      }
    } catch (error) {
      console.error('Logout error:', error);
      set({ error: 'Failed to logout' });
    } finally {
      set({ isLoading: false });
    }
  }
}));