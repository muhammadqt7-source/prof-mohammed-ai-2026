import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Cpu, Sparkles, ChevronLeft } from 'lucide-react';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const [canSkip, setCanSkip] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2800);

    const skipTimer = setTimeout(() => {
      setCanSkip(true);
    }, 700);

    return () => {
      clearTimeout(timer);
      clearTimeout(skipTimer);
    };
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#030712] overflow-hidden">
      {/* Ambient background glow & grid */}
      <div className="absolute inset-0 cyber-grid-overlay opacity-30" />
      <div className="absolute w-[500px] h-[500px] rounded-full bg-radial from-amber-500/20 via-transparent to-transparent blur-3xl pointer-events-none" />

      {/* Center Brand Hologram */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 flex flex-col items-center text-center px-6 max-w-xl"
      >
        {/* Glowing AI Core Icon */}
        <motion.div
          initial={{ rotate: -15, scale: 0.7 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="relative mb-6"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-400/20 via-amber-600/10 to-transparent border border-amber-400/40 flex items-center justify-center shadow-[0_0_40px_rgba(234,179,8,0.3)] backdrop-blur-md">
            <Cpu className="w-10 h-10 text-amber-400" />
          </div>
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-ping" />
        </motion.div>

        {/* Brand Name with Metallic Gold 3D & Light Sweep */}
        <div className="light-sweep-container rounded-lg p-2">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-3xl md:text-5xl font-extrabold gold-gradient-text tracking-wide mb-2"
          >
            بروفيسور محمد مهدي AI
          </motion.h1>
          <div className="text-xs md:text-sm text-amber-200/70 font-semibold tracking-widest uppercase">
            Professor Mohammad Mahdi AI
          </div>
        </div>

        {/* Motto: تعلم • أنجز • تطور */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
          className="mt-6 flex items-center gap-3 px-5 py-2 rounded-full bg-amber-500/10 border border-amber-400/30 text-amber-300 font-medium text-sm md:text-base shadow-[0_0_20px_rgba(234,179,8,0.15)]"
        >
          <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
          <span>تعلم</span>
          <span className="text-amber-500/60">•</span>
          <span>أنجز</span>
          <span className="text-amber-500/60">•</span>
          <span>تطور</span>
        </motion.div>

        {/* Loading Bar Animation */}
        <div className="w-48 h-1 bg-neutral-900 rounded-full mt-10 overflow-hidden border border-amber-400/20">
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 2.2, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_10px_#eab308]"
          />
        </div>
      </motion.div>

      {/* Skip Button */}
      {canSkip && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={onFinish}
          className="absolute bottom-8 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs text-neutral-400 hover:text-amber-300 hover:bg-neutral-900/60 border border-neutral-800 transition-all cursor-pointer"
        >
          <span>تخطي والبدء فوراً</span>
          <ChevronLeft className="w-3.5 h-3.5" />
        </motion.button>
      )}
    </div>
  );
};
