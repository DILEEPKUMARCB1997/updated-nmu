import { Button, Divider, Popover, Segmented, Typography } from 'antd';
import { useThemeStore } from './useStore';
import { SettingOutlined } from '@ant-design/icons';
import { Flexbox } from 'react-layout-kit';
import ColorSwatch from './ColorSwatch';
import { ThemeIcon } from './CustomsIcons';
import { useEffect } from 'react';

const options = [
  { label: 'Auto', value: 'auto' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default () => {
  const { changeMode, changePrimaryColor, mode } = useThemeStore();

  const content = (
    <Flexbox direction="vertical" align="center" gap={4}>
      <Typography.Text>Change Color Mode</Typography.Text>
      <Segmented
        value={mode}
        onChange={(v) => changeMode(v)}
        options={options}
      />
      <Divider style={{ margin: '8px 0' }} />
      <Typography.Text>Change Primary Color</Typography.Text>
      <ColorSwatch />
    </Flexbox>
  );
  return (
    <Popover
      placement="bottom"
      title="MNMS Settings"
      content={content}
      trigger="click"
      showArrow={false}
      style={{ width: '300px' }}
    >
      <Button type="default" icon={<ThemeIcon />} />
    </Popover>
  );
};
