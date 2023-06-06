import { useEffect } from 'react';
import enUS from 'antd/locale/en_US';
import { ThemeProvider } from 'antd-style';
import { App as AntdApp, ConfigProvider } from 'antd';
import { useLocation } from 'react-router-dom';
import {
  REQUEST_CHANGE_THEME_MODE,
  REQUEST_HIDE_SHOW_MENU,
  SEND_RP_ALL_DEVICES_LIST,
} from 'main/utils/IPCEvents';
import './App.css';
import GlobalStyle from './utils/themes/GlobalStyle';
import AppRoutes from './utils/router/AppRoutes';
import {
  customDarkAlgorithm,
  customLightAlgorithm,
  useThemeStore,
} from './utils/themes/useStore';

export default function App() {
  const { mode, colorPrimary } = useThemeStore();
  const location = useLocation();
  useEffect(() => {
    window.electron.ipcRenderer.on(SEND_RP_ALL_DEVICES_LIST, (_, args) => {
      console.log(JSON.parse(args));
    });
  }, []);

  useEffect(() => {
    if (mode === 'dark') {
      window.electron.ipcRenderer.send(REQUEST_CHANGE_THEME_MODE, 'dark');
    } else {
      window.electron.ipcRenderer.send(REQUEST_CHANGE_THEME_MODE, 'light');
    }
  }, [mode]);

  useEffect(() => {
    if (location.pathname === '/login') {
      window.electron.ipcRenderer.send(REQUEST_HIDE_SHOW_MENU, false);
    } else {
      window.electron.ipcRenderer.send(REQUEST_HIDE_SHOW_MENU, true);
    }
  }, [location.pathname]);

  return (
    <ThemeProvider
      themeMode={mode}
      theme={{
        token: {
          colorPrimary,
          borderRadius: 4,
        },
        algorithm:
          mode === 'dark' ? [customDarkAlgorithm] : [customLightAlgorithm],
        components: {
          Button: {
            fontSize: 14,
          },
          Card: {
            boxShadow:
              'rgb(0 0 0 / 20%) 0px 2px 1px -1px, rgb(0 0 0 / 14%) 0px 1px 1px 0px, rgb(0 0 0 / 12%) 0px 1px 3px 0px',
          },
        },
      }}
    >
      <GlobalStyle />
      <ConfigProvider locale={enUS} theme={{ inherit: true }}>
        <AntdApp>
          <AppRoutes />
        </AntdApp>
      </ConfigProvider>
    </ThemeProvider>
  );
}
