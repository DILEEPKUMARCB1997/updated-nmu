import React from 'react';
import { useDispatch } from 'react-redux';
import { Form, Input, Button, Image, Space, App, Card, Modal } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { Center } from 'react-layout-kit';
import { useNavigate } from 'react-router-dom';
import logo from '../assets/images/atop-full-logo.svg';
import { getLoginData } from 'renderer/feature/userManagementSlice';
import {
  REQUEST_MP_GET_USER_DETAILS,
  RESPONSE_RP_GET_USER_DETAILS,
} from 'main/utils/IPCEvents';

const LoginPage = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { notification } = App.useApp();

  const onFinish = (values) => {
    console.log(values);
    window.electron.ipcRenderer.once(
      RESPONSE_RP_GET_USER_DETAILS,
      (event, arg) => {
        console.log(arg);
        if (arg.success) {
          const username = arg.data.username;
          const userType = arg.data.userType;
          dispatch(getLoginData({ username, userType }));
          localStorage.setItem('username', arg.data.username);
          notification.success({ message: 'Successfully loggedIn.' });
          navigate('/');
        } else {
          notification.error({ message: arg.msg });
        }
      }
    );
    window.electron.ipcRenderer.send(REQUEST_MP_GET_USER_DETAILS, {
      username: values.username,
      password: values.password,
    });
  };
  return (
    <Center height="100vh" width="100vw">
      <Card bordered={false}>
        <LoginForm onFinish={onFinish} form={form} />
      </Card>
    </Center>
  );
};

export default LoginPage;

const LoginForm = (props) => {
  return (
    <Space direction="vertical" align="center" size={15}>
      <Image height={56} src={logo} preview={false} />
      <Form
        name="nmu-login-form"
        size="large"
        autoComplete="off"
        onFinish={props.onFinish}
        form={props.form}
      >
        <Form.Item
          name="username"
          rules={[
            {
              required: true,
              message: 'Please input your username !',
            },
          ]}
        >
          <Input prefix={<UserOutlined />} placeholder="Username" />
        </Form.Item>
        <Form.Item
          name="password"
          rules={[
            {
              required: true,
              message: 'Please input your Password!',
            },
          ]}
        >
          <Input.Password
            prefix={<LockOutlined />}
            type="password"
            placeholder="Password"
          />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" block>
            Sign in
          </Button>
        </Form.Item>
      </Form>
    </Space>
  );
};
