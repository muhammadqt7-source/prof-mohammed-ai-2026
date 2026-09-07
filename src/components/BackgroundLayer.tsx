import React from 'react';
import { ThemeConfig } from '../config/theme.js';

interface BackgroundLayerProps {
  config: ThemeConfig;
}

export const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ config }) => {
  const blurClasses = {
    none: 'backdrop-blur-none',
    sm: 'backdrop-blur-xs',
    md: 'backdrop-blur-sm',
    lg: 'backdrop-blur-md',
    xl: 'backdrop-blur-lg',
  }[config.blurIntensity];

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      {/* 1. Base Background Layer (Image / Gradient / Video) */}
      <div className="absolute inset-0 w-full h-full">
        {config.backgroundType === 'image' && config.backgroundImage ? (
          <img
            src={config.backgroundImage}
            alt="AI Lab Background"
            className="w-full h-full object-cover object-center transform scale-105 transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />
        ) : config.backgroundType === 'gradient' ? (
          <div className="w-full h-full bg-radial from-[#0a1538] via-[#05091a] to-[#02040a]" />
        ) : (
          <div className="w-full h-full bg-[#030712]" />
        )}
      </div>

      {/* 2. Overlay Layer with Blur & Opacity Control */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${blurClasses}`}
        style={{
          backgroundColor: config.overlayColor,
          opacity: config.overlayOpacity,
        }}
      />

      {/* 3. Cyber Holographic Grid Layer */}
      {config.enableHoloGrid && (
        <div className="absolute inset-0 cyber-grid-overlay opacity-35" />
      )}

      {/* 4. Ambient Golden Glow Light Pools */}
      {config.enableGoldGlow && (
        <>
          <div className="absolute -top-40 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/3 -left-20 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 right-10 w-96 h-96 bg-amber-600/10 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      {/* 5. Futuristic Scanning Line Animation */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-amber-400/[0.02] to-transparent h-32 w-full animate-pulse pointer-events-none" />
    </div>
  );
};
