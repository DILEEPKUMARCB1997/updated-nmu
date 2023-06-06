import { DashboardOutlined, DesktopOutlined } from '@ant-design/icons';

const routes = {
  route: {
    path: '/',
    routes: [
      {
        path: '/dashboard',
        name: 'Dashboard',
        icon: <DashboardOutlined />,
      },
      {
        path: '/devices',
        name: 'Devices',
        icon: <DesktopOutlined />,
      },
    ],
  },
  location: {
    pathname: '/',
  },
};
export default routes;
