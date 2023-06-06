import React from "react";
import { Global, css } from "@emotion/react";
import { useTheme } from "antd-style";

const GlobalStyle = () => {
  const token = useTheme();
  return (
    <Global
      styles={css`
        html {
          direction: initial;
          &.rtl {
            direction: rtl;
          }
        }
        body {
          overflow-x: hidden;
          color: ${token.colorText};
          font-size: ${token.fontSize}px;
          font-family: ${token.fontFamily};
          line-height: ${token.lineHeight};
          background: ${token.colorBgLayout};
          transition: all 0s cubic-bezier(0.075, 0.82, 0.165, 1);
          letter-spacing: 0.02857em;
        }
        .ant-btn {
          text-transform: uppercase;
          font-weight: 500;
          letter-spacing: 0.02857em;
        }
      `}
    />
  );
};

export default GlobalStyle;
