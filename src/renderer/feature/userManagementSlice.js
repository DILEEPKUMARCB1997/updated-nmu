import { createSlice } from '@reduxjs/toolkit';

const userManagementSlice = createSlice({
  name: 'usermgmtslice',
  initialState: {
    loggedInUser: {},
    usersData: [],
  },
  reducers: {
    getLoginData: (state, { payload }) => {
      state.loggedInUser = { ...payload };
    },
    clearUsersData: (state, { payload }) => {
      state.loggedInUser = {};
      state.usersData = [];
    },
  },
});

export const { getLoginData, clearUsersData } = userManagementSlice.actions;

export default userManagementSlice;
