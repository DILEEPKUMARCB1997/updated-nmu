import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { theme as antdThme } from 'antd';

export const useThemeStore = create(
  persist(
    (set) => ({
      mode: 'auto',
      colorPrimary: '#13c2c2',
      changeMode: (mode) => set((state) => ({ ...state, mode })),
      changePrimaryColor: (colorPrimary) =>
        set((state) => ({ ...state, colorPrimary })),
    }),
    {
      name: 'nmu-theme', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

export const customDarkAlgorithm = (seedToken, mapToken) => {
  return antdThme.darkAlgorithm({
    ...seedToken,
    ...mapToken,
    colorBgBase: '#1a2035',
  });
};
export const customLightAlgorithm = (seedToken, mapToken) => {
  return antdThme.defaultAlgorithm({
    ...seedToken,
    ...mapToken,
    colorBgBase: '#fff',
  });
};
