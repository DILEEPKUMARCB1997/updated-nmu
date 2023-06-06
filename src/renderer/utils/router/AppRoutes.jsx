import { Navigate, useRoutes } from 'react-router-dom';
import MainLayout from '../../layout/Mainlayout';
import DashboardPage from '../../pages/DashboardPage';
import DevicePage from '../../pages/DevicePage';
import LoginPage from '../../pages/LoginPage';
import PageNotFound from '../../pages/PageNotFound';

const AppRoutes = () => {
  let element = useRoutes([
    {
      path: '/',
      element: <MainLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" /> },
        {
          path: 'dashboard',
          element: <DashboardPage />,
        },
        {
          path: 'devices',
          element: <DevicePage />,
        },
      ],
    },
    { path: '/login', element: <LoginPage /> },
    { path: '*', element: <PageNotFound /> },
  ]);

  return element;
};

export default AppRoutes;
