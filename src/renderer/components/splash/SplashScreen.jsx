import { useState, useEffect } from 'react';
import { Typography } from 'antd';
import icon from '../../../../assets/icons/atop_tr.png';
import './SplashScreen.css';

const { Title } = Typography;
const VERSION = 'J1.8';

function SplashScreen() {
  const [showIcon, setShowIcon] = useState(false);

  useEffect(() => {
    const iconTimeout = setTimeout(() => {
      setShowIcon(true);
    }, 2000);

    return () => {
      clearTimeout(iconTimeout);
    };
  }, []);

  return (
    <div className="splash">
      <img
        src={icon}
        alt="icon"
        className={showIcon ? 'splash_icon' : 'splash_icon_hide'}
      />
      <Title
        level={1}
        style={{ fontSize: '40px', textAlign: 'center', marginBottom: 0 }}
      >
        Network Management Utility
      </Title>
      <Title level={3} className={`version_text`}>
        {VERSION}
      </Title>
    </div>
  );
}

export default SplashScreen;
