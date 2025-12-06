
/// <reference lib="dom" />
import React from 'react';
import { RotationPreset, InteractionMode, PointerMode } from '../types';
import { translations } from '../utils/translations';

interface UIOverlayProps {
  presets: RotationPreset[];
  currentPresetId: string;
  setPresetId: (id: string) => void;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  pointerMode: PointerMode;
  setPointerMode: (mode: PointerMode) => void;
  isFreezeMode: boolean;
  setIsFreezeMode: (val: boolean) => void;
  onClear: () => void;
  onSave: () => void;
  onLoad: () => void;
  cardCount: number;
  lang: 'en' | 'zh';
  onOpenSettings: () => void;
  onBackToMenu: () => void;
}

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  presets,
  currentPresetId,
  setPresetId,
  interactionMode,
  setInteractionMode,
  pointerMode,
  setPointerMode,
  isFreezeMode,
  setIsFreezeMode,
  onClear,
  onSave,
  onLoad,
  cardCount,
  lang,
  onOpenSettings,
  onBackToMenu
}) => {
  const t = translations[lang];
  const showPlaceControls = pointerMode === PointerMode.PLACE || pointerMode === PointerMode.MOVE;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex flex-col justify-between p-6">
      
      {/* Header */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div>
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">{t.title}</h1>
          <p className="text-gray-300 text-sm mt-1">{t.subtitle}</p>
          
          {pointerMode === PointerMode.PLACE && (
            <div className="mt-4 bg-black/60 backdrop-blur rounded-lg p-1 inline-flex border border-gray-700">
              <button 
                onClick={() => setInteractionMode(InteractionMode.QUICK)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${interactionMode === InteractionMode.QUICK ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {t.quickPlace}
              </button>
              <button 
                onClick={() => setInteractionMode(InteractionMode.PRECISION)}
                className={`px-4 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-colors ${interactionMode === InteractionMode.PRECISION ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'}`}
              >
                {t.precision}
              </button>
            </div>
          )}
        </div>
        
        <div className="flex flex-col gap-2 items-end">
           <div className="flex gap-2 mb-1">
             <button 
                onClick={onBackToMenu}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
             >
                {t.backToMenu}
             </button>
             <button 
                onClick={onSave}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
             >
                {t.save}
             </button>
             <button 
                onClick={onLoad}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
             >
                {t.load}
             </button>
           </div>
           
           <div className="bg-black/50 backdrop-blur-md p-4 rounded-lg border border-gray-600 text-right">
             <div className="text-white text-xs uppercase tracking-wider">{t.cardsPlaced}</div>
             <div className="text-3xl font-mono text-blue-400">{cardCount}</div>
           </div>
           
           <button 
             onClick={onClear}
             className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded text-sm font-bold transition-colors shadow-lg"
           >
             {t.clearTable}
           </button>
        </div>
      </div>

      {/* Center Notification */}
      {pointerMode === PointerMode.PLACE && interactionMode === InteractionMode.PRECISION && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center opacity-30">
          <div className="text-amber-400 border-2 border-amber-400 rounded-full w-12 h-12 flex items-center justify-center text-2xl mx-auto mb-2">+</div>
        </div>
      )}

      {/* Bottom Toolbar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-auto z-50">
        <div className="bg-black/80 backdrop-blur-xl p-1.5 rounded-2xl border border-gray-600 flex gap-1 shadow-2xl">
           <button
             onClick={() => setPointerMode(PointerMode.PLACE)}
             className={`px-6 py-3 rounded-xl font-bold text-sm uppercase transition-all flex items-center gap-2 ${pointerMode === PointerMode.PLACE ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
           >
             <span className="text-lg">✚</span> {t.place}
           </button>
           <button
             onClick={() => setPointerMode(PointerMode.MOVE)}
             className={`px-6 py-3 rounded-xl font-bold text-sm uppercase transition-all flex items-center gap-2 ${pointerMode === PointerMode.MOVE ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
           >
             <span className="text-lg">✋</span> {t.move}
           </button>
           <button
             onClick={() => setPointerMode(PointerMode.DELETE)}
             className={`px-6 py-3 rounded-xl font-bold text-sm uppercase transition-all flex items-center gap-2 ${pointerMode === PointerMode.DELETE ? 'bg-red-600 text-white shadow-lg' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
           >
             <span className="text-lg">✕</span> {t.delete}
           </button>
        </div>
      </div>


      {/* Bottom Side Controls */}
      <div className="flex justify-between items-end w-full pointer-events-auto mb-16">
        
        <div className="flex gap-6 items-end">
            {/* Presets */}
            {showPlaceControls && interactionMode === InteractionMode.QUICK && (
              <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-gray-700 flex flex-col gap-2 relative">
                <div className="flex justify-between items-center">
                    <span className="text-gray-300 text-xs uppercase tracking-widest ml-1">{t.presets}</span>
                    <button 
                        onClick={onOpenSettings}
                        className="text-gray-400 hover:text-white"
                        title={t.settings}
                    >
                        ⚙️
                    </button>
                </div>
                <div className="grid grid-cols-5 gap-2">
                    {presets.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => setPresetId(opt.id)}
                        className={`
                        p-2 rounded-lg font-medium transition-all flex flex-col items-center w-[60px] relative overflow-hidden
                        ${currentPresetId === opt.id 
                            ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105 z-10' 
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
                        `}
                    >
                        <span className="absolute top-0.5 right-1.5 text-[8px] opacity-50 font-mono">{opt.shortcut}</span>
                        <span className="text-lg leading-none mt-1 mb-1">{opt.icon}</span>
                        <span className="text-[9px] leading-tight text-center truncate w-full px-1">
                            {t[opt.name as keyof typeof t] || opt.name}
                        </span>
                    </button>
                    ))}
                </div>
              </div>
            )}

            {/* Precision UI */}
            {pointerMode === PointerMode.PLACE && interactionMode === InteractionMode.PRECISION && (
               <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-amber-600/50 flex flex-col gap-3 shadow-[0_0_30px_rgba(217,119,6,0.15)]">
                 <span className="text-amber-400 text-xs uppercase tracking-widest font-bold">{t.precisionTool}</span>
                 <div className="flex items-center gap-4 text-gray-300 text-sm">
                    <div className="flex gap-2">
                      <span className="bg-gray-700 px-2 py-1 rounded text-white font-mono">T</span> {t.translate}
                    </div>
                    <div className="flex gap-2">
                      <span className="bg-gray-700 px-2 py-1 rounded text-white font-mono">R</span> {t.rotate}
                    </div>
                 </div>
                 <button 
                   id="precision-place-btn" 
                   className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 active:transform active:scale-95 transition-all"
                   onClick={() => {
                     window.dispatchEvent(new CustomEvent('trigger-precision-place'));
                   }}
                 >
                   <span>{t.placeCard}</span>
                   <span className="bg-black/20 px-2 py-0.5 rounded text-[10px] font-mono">{t.pressEnter}</span>
                 </button>
               </div>
            )}

            {/* Freeze Button */}
            <button
                onClick={() => setIsFreezeMode(!isFreezeMode)}
                className={`
                    px-6 py-4 rounded-xl font-bold text-sm transition-all border relative shadow-xl flex items-center gap-3 h-[110px]
                    ${isFreezeMode 
                        ? 'bg-cyan-900/90 border-cyan-400 text-cyan-100 shadow-[0_0_30px_rgba(34,211,238,0.4)]' 
                        : 'bg-gray-800/80 border-gray-600 text-gray-300 hover:bg-gray-700'}
                `}
            >
                <span className="text-4xl">
                    {isFreezeMode ? '⏸' : '▶'}
                </span>
                <div className="flex flex-col items-start">
                    <span className={`uppercase tracking-wider text-[10px] mb-1 ${isFreezeMode ? 'text-cyan-300' : 'text-gray-500'}`}>
                        {isFreezeMode ? t.timeStopped : t.physicsActive}
                    </span>
                    <span className="text-lg tracking-tight">
                        {isFreezeMode ? t.resume : t.freeze}
                    </span>
                    <span className="text-[10px] font-mono opacity-50 mt-1">{t.pressL}</span>
                </div>
            </button>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;
