
/// <reference lib="dom" />
import React from 'react';
import { translations } from '../utils/translations';

interface MainMenuProps {
  onStart: () => void;
  onLoad: () => void;
  onSettings: () => void;
  hasSave: boolean;
  lang: 'en' | 'zh';
}

const MainMenu: React.FC<MainMenuProps> = ({ onStart, onLoad, onSettings, hasSave, lang }) => {
  const t = translations[lang];

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f172a]">
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-20 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/4 w-96 h-96 bg-blue-600 rounded-full blur-[128px]"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600 rounded-full blur-[128px]"></div>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-12 w-96">
        <div className="text-center">
            <h1 className="text-6xl font-black text-white tracking-tighter drop-shadow-2xl mb-2">
                HOUSE OF <span className="text-blue-500">CARDS</span>
            </h1>
            <p className="text-gray-400 text-lg uppercase tracking-widest">{t.subtitle}</p>
        </div>

        <div className="flex flex-col gap-4 w-full">
            <button 
                onClick={onStart}
                className="w-full py-4 bg-white text-black font-bold text-xl uppercase tracking-wider hover:bg-gray-200 transition-transform hover:scale-105 active:scale-95 shadow-xl rounded-sm"
            >
                {t.startGame}
            </button>
            
            <button 
                onClick={onLoad}
                disabled={!hasSave}
                className={`w-full py-4 font-bold text-xl uppercase tracking-wider border-2 transition-all rounded-sm
                    ${hasSave 
                        ? 'border-white text-white hover:bg-white/10 hover:scale-105 active:scale-95' 
                        : 'border-gray-700 text-gray-700 cursor-not-allowed'}
                `}
            >
                {t.continueGame}
            </button>
            
            <button 
                onClick={onSettings}
                className="w-full py-4 border-2 border-gray-600 text-gray-400 font-bold text-xl uppercase tracking-wider hover:border-gray-400 hover:text-white transition-colors rounded-sm"
            >
                {t.settings}
            </button>

            <button 
                onClick={() => {
                   if(confirm(lang === 'zh' ? '确定要退出吗？' : 'Are you sure?')) {
                     window.location.href = 'about:blank'; 
                   }
                }}
                className="w-full py-4 text-red-900 font-bold text-lg uppercase tracking-wider hover:text-red-500 transition-colors"
            >
                {t.exitGame}
            </button>
        </div>

        <div className="text-gray-600 text-xs mt-8">
            {t.credits} • v1.1.0
        </div>
      </div>
    </div>
  );
};

export default MainMenu;
