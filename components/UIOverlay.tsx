/// <reference lib="dom" />
import React from 'react';
import { RotationMode, InteractionMode, PointerMode } from '../types';

interface UIOverlayProps {
  currentMode: RotationMode;
  setMode: (mode: RotationMode) => void;
  interactionMode: InteractionMode;
  setInteractionMode: (mode: InteractionMode) => void;
  pointerMode: PointerMode;
  setPointerMode: (mode: PointerMode) => void;
  isFreezeMode: boolean;
  setIsFreezeMode: (val: boolean) => void;
  onClear: () => void;
  cardCount: number;
  lang: 'en' | 'zh';
  setLang: (lang: 'en' | 'zh') => void;
}

const translations = {
  en: {
     title: "House of Cards",
     subtitle: "Physics Construction Simulator",
     cardsPlaced: "Cards Placed",
     clearTable: "Clear Table",
     quickPlace: "Quick Place",
     precision: "Precision (Blender)",
     place: "Place",
     move: "Move",
     delete: "Delete",
     presets: "Presets",
     timeStopped: "Time Stopped",
     physicsActive: "Physics Active",
     resume: "RESUME",
     freeze: "FREEZE",
     controls: "Controls",
     togglePrecision: "Toggle Precision",
     rotateYaw: "Rotate (Yaw)",
     tiltPitch: "Tilt (Pitch)",
     rollZ: "Roll (Z-Axis)",
     dragMove: "Drag blue cards to move them.",
     clickDelete: "Click red cards to delete.",
     resetRot: "Reset Rot",
     precisionTool: "Precision Tool",
     translate: "Translate",
     rotate: "Rotate",
     placeCard: "PLACE CARD",
     flat: "Flat",
     standX: "Stand X",
     standY: "Stand Y",
     standZ: "Stand Z",
     leanFwd: "Lean Fwd",
     leanBack: "Lean Back",
     leanLeft: "Lean Left",
     leanRight: "Lean Right",
     roofFwd: "Roof Fwd",
     roofBack: "Roof Back",
     pressL: "Press 'L'",
     pressEnter: "ENTER"
  },
  zh: {
     title: "纸牌屋 3D",
     subtitle: "物理搭建模拟器",
     cardsPlaced: "已放置",
     clearTable: "清空桌面",
     quickPlace: "快速放置",
     precision: "精准模式 (Blender)",
     place: "放置",
     move: "移动",
     delete: "删除",
     presets: "旋转预设",
     timeStopped: "时间静止",
     physicsActive: "物理生效",
     resume: "恢复时间",
     freeze: "时间暂停",
     controls: "操作指南",
     togglePrecision: "切换精准模式",
     rotateYaw: "水平旋转 (Yaw)",
     tiltPitch: "倾斜 (Pitch)",
     rollZ: "翻滚 (Roll)",
     dragMove: "拖拽蓝色卡牌以移动",
     clickDelete: "点击红色卡牌以删除",
     resetRot: "重置旋转",
     precisionTool: "精准工具",
     translate: "平移",
     rotate: "旋转",
     placeCard: "确认放置",
     flat: "平放",
     standX: "横立",
     standY: "侧立",
     standZ: "竖立",
     leanFwd: "前倾",
     leanBack: "后倾",
     leanLeft: "左倾",
     leanRight: "右倾",
     roofFwd: "前屋顶",
     roofBack: "后屋顶",
     pressL: "按 'L' 键",
     pressEnter: "回车"
  }
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  currentMode, 
  setMode, 
  interactionMode,
  setInteractionMode,
  pointerMode,
  setPointerMode,
  isFreezeMode,
  setIsFreezeMode,
  onClear,
  cardCount,
  lang,
  setLang
}) => {
  const t = translations[lang];

  const presets = [
      { mode: RotationMode.FLAT, label: t.flat, icon: '▀', key: '1' },
      { mode: RotationMode.STAND_X, label: t.standX, icon: '▮', key: '2' },
      { mode: RotationMode.STAND_Y, label: t.standY, icon: '▬', key: '3' },
      { mode: RotationMode.STAND_Z, label: t.standZ, icon: '▎', key: '4' },
      { mode: RotationMode.TILT_X_FWD, label: t.leanFwd, icon: '◢', key: '5' },
      { mode: RotationMode.TILT_X_BACK, label: t.leanBack, icon: '◣', key: '6' },
      { mode: RotationMode.TILT_Z_LEFT, label: t.leanLeft, icon: '◤', key: '7' },
      { mode: RotationMode.TILT_Z_RIGHT, label: t.leanRight, icon: '◥', key: '8' },
      { mode: RotationMode.ROOF_FWD, label: t.roofFwd, icon: '▲', key: '9' },
      { mode: RotationMode.ROOF_BACK, label: t.roofBack, icon: '▼', key: '0' },
  ];

  const showPlaceControls = pointerMode === PointerMode.PLACE || pointerMode === PointerMode.MOVE;

  return (
    <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 flex flex-col justify-between p-6">
      
      {/* Header */}
      <div className="flex justify-between items-start pointer-events-auto">
        <div>
          <h1 className="text-4xl font-bold text-white drop-shadow-lg">{t.title}</h1>
          <p className="text-gray-300 text-sm mt-1">{t.subtitle}</p>
          
          {/* Mode Toggle (Quick/Precision) - Only for Place Mode */}
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
                onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-3 py-1 rounded text-xs font-bold transition-colors"
             >
                {lang === 'zh' ? 'EN' : '中文'}
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

      {/* Center Notification for Precision Mode */}
      {pointerMode === PointerMode.PLACE && interactionMode === InteractionMode.PRECISION && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none text-center opacity-30">
          <div className="text-amber-400 border-2 border-amber-400 rounded-full w-12 h-12 flex items-center justify-center text-2xl mx-auto mb-2">+</div>
        </div>
      )}

      {/* MAIN POINTER MODE TOOLBAR (Bottom Center) */}
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


      {/* Bottom Sections (Side Controls) */}
      <div className="flex justify-between items-end w-full pointer-events-auto mb-16"> {/* mb-16 to clear center toolbar */}
        
        <div className="flex gap-6 items-end">
            {/* Presets - Visible in Place or Move Mode */}
            {showPlaceControls && interactionMode === InteractionMode.QUICK && (
              <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-gray-700 flex flex-col gap-2">
                <span className="text-gray-300 text-xs uppercase tracking-widest self-start ml-1">{t.presets}</span>
                <div className="grid grid-cols-5 gap-2">
                    {presets.map((opt) => (
                    <button
                        key={opt.mode}
                        onClick={() => setMode(opt.mode)}
                        className={`
                        p-2 rounded-lg font-medium transition-all flex flex-col items-center w-[60px] relative
                        ${currentMode === opt.mode 
                            ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-105 z-10' 
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}
                        `}
                    >
                        <span className="absolute top-0.5 right-1.5 text-[8px] opacity-50 font-mono">{opt.key}</span>
                        <span className="text-lg leading-none mt-1 mb-1">{opt.icon}</span>
                        <span className="text-[9px] leading-tight text-center">{opt.label}</span>
                    </button>
                    ))}
                </div>
              </div>
            )}

            {/* Precision Controls */}
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

            {/* Physics Controls (Time Stop) - Always Visible */}
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

        {/* Controls Guide */}
        <div className="bg-black/60 backdrop-blur-md p-4 rounded-xl border border-gray-700 ml-4">
          <span className="text-gray-300 text-xs uppercase tracking-widest mb-2 block">{t.controls}</span>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm text-gray-300">
            <div className="flex justify-between">
              <span>{t.togglePrecision}</span>
              <span className="font-mono text-white bg-gray-700 px-1 rounded">TAB</span>
            </div>
            
            {showPlaceControls && interactionMode === InteractionMode.QUICK && (
              <>
                <div className="flex justify-between">
                  <span>{t.rotateYaw}</span>
                  <span className="font-mono text-white bg-gray-700 px-1 rounded">Q / E</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.tiltPitch}</span>
                  <span className="font-mono text-white bg-gray-700 px-1 rounded">R / F</span>
                </div>
                <div className="flex justify-between">
                  <span>{t.rollZ}</span>
                  <span className="font-mono text-white bg-gray-700 px-1 rounded">Z / X</span>
                </div>
              </>
            )}

            {pointerMode === PointerMode.MOVE && (
                <div className="col-span-2 text-blue-400 text-xs py-1">
                   {t.dragMove}
                </div>
            )}
            
            {pointerMode === PointerMode.DELETE && (
                <div className="col-span-2 text-red-400 text-xs py-1">
                   {t.clickDelete}
                </div>
            )}

            <div className="flex justify-between">
              <span>{t.resetRot}</span>
              <span className="font-mono text-white bg-gray-700 px-1 rounded">SPACE</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default UIOverlay;