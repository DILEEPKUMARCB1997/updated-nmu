import React from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import 'antd/dist/reset.css';
import SplashScreen from './components/splash/SplashScreen';

const container = document.getElementById('root');
const root = createRoot(container);
// @ts-ignore
root.render(<SplashScreen />);
