import React from 'react';
import { Home, CheckSquare, PlusCircle, Coins, Layers } from 'lucide-react';
import { ActiveTab } from './Header.js';

interface MobileNavProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeTab, onSelectTab }) => {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#070b1e]/90 backdrop-blur-xl border-t border-amber-500/20 px-3 py-2">
      <div className="flex items-center justify-around max-w-md mx-auto">
        <button
          onClick={() => onSelectTab('home')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">الرئيسية</span>
        </button>

        <button
          onClick={() => onSelectTab('tasks')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'tasks'
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <CheckSquare className="w-5 h-5" />
          <span className="text-[10px]">المهام</span>
        </button>

        <button
          onClick={() => onSelectTab('create-campaign')}
          className="flex flex-col items-center -mt-5 group cursor-pointer"
        >
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-amber-600 via-amber-400 to-yellow-300 p-0.5 shadow-[0_0_20px_rgba(234,179,8,0.4)] transition-transform active:scale-95">
            <div className="w-full h-full rounded-full bg-[#0a0f24] flex items-center justify-center text-amber-400 group-hover:bg-[#0e1636]">
              <PlusCircle className="w-6 h-6" />
            </div>
          </div>
          <span className="text-[10px] text-amber-300 font-bold mt-1">إنشاء</span>
        </button>

        <button
          onClick={() => onSelectTab('my-campaigns')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'my-campaigns'
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Layers className="w-5 h-5" />
          <span className="text-[10px]">حملاتي</span>
        </button>

        <button
          onClick={() => onSelectTab('points')}
          className={`flex flex-col items-center gap-1 py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'points'
              ? 'text-amber-400 font-bold'
              : 'text-neutral-400 hover:text-neutral-200'
          }`}
        >
          <Coins className="w-5 h-5" />
          <span className="text-[10px]">نقاطي</span>
        </button>
      </div>
    </div>
  );
};
