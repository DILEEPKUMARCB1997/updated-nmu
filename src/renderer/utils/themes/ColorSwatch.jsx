import { Popover } from "antd";
import React from "react";
import { BlockPicker } from "react-color";
import { useThemeStore } from "./useStore";
import { useTheme } from "antd-style";

const ColorSwatch = () => {
  const { changePrimaryColor } = useThemeStore();
  const token = useTheme();
  const handleColorChange = (color) => {
    changePrimaryColor(color.hex);
  };
  return (
    <Popover
      content={
        <BlockPicker
          triangle="top"
          onChange={handleColorChange}
          color={token.colorPrimary}
          colors={[
            "#3B71CA",
            "#F5222D",
            "#FA541C",
            "#FAAD14",
            "#13c3c3",
            "#52C41A",
            "#2F54EB",
            "#722ED1",
          ]}
          styles={{
            default: {
              head: {
                borderTopRightRadius: token.borderRadius,
                borderTopLeftRadius: token.borderRadius,
              },
            },
          }}
        />
      }
      trigger="click"
      overlayInnerStyle={{
        padding: 0,
        background: "transparent",
      }}
      showArrow={false}
    >
      <div
        style={{
          padding: "6px",
          background: token.colorFill,
          borderRadius: token.borderRadius,
          cursor: "pointer",
          boxShadow: token.boxShadow,
          width: "52px",
        }}
      >
        <div
          style={{
            width: "40px",
            height: "15px",
            borderRadius: "3px",
            background: token.colorPrimary,
          }}
        />
      </div>
    </Popover>
  );
};

export default ColorSwatch;
