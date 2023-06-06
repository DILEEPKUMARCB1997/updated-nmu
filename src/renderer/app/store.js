import { configureStore } from '@reduxjs/toolkit';
import userManagementSlice from 'renderer/feature/userManagementSlice';

export const store = configureStore({
  reducer: {
    userManagement: userManagementSlice.reducer,
  },
  devTools: process.env.NODE_ENV !== 'production',
});
