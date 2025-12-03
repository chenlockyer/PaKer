
/// <reference lib="dom" />
import React, { useState } from 'react';
import { RotationPreset, InteractionMode, PointerMode } from '../types';

interface UIOverlayProps {
  presets: RotationPreset[];
  currentPresetId: string;
  setPresetId: (id: string) => void;
  onAddPreset: () => void;
  onUpdatePreset: (preset: RotationPreset) => void;
  onDeletePreset: (id: string) => void;
  onResetPresets: () => void;
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
  setLang: (lang: 'en' | 'zh') => void;
}

const translations = {
  en: {
     title: "House of Cards",
     subtitle: "Physics Construction Simulator",
     cardsPlaced: "Cards Placed",
     clearTable: "Clear Table",
     save: "Save",
     load: "Load",
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
     pressL: "Press 'L'",
     pressEnter: "ENTER",
     settings: "Settings",
     presetEditor: "Preset Editor",
     add: "Add",
     reset: "Reset",
     name: "Name",
     shortcut: "Key",
     icon: "Icon",
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
  },
  zh: {
     title: "纸牌屋 3D",
     subtitle: "物理搭建模拟器",
     cardsPlaced: "已放置",
     clearTable: "清空桌面",
     save: "存档",
     load: "读档",
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
     pressL: "按 'L' 键",
     pressEnter: "回车",
     settings: "设置",
     presetEditor: "预设编辑器",
     add: "新建",
     reset: "重置",
     name: "名称",
     shortcut: "快捷键",
     icon: "图标",
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
  }
};

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  presets,
  currentPresetId,
  setPresetId,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
  onResetPresets,
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
  setLang
}) => {
  const t = translations[lang];
  const [showSettings, setShowSettings] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const showPlaceControls = pointerMode === PointerMode.PLACE || pointerMode === PointerMode.MOVE;

  // Editor Handlers
  const editingPreset = editingId ? presets.find(p => p.id === editingId) : null;
  const updateEditingValue = (field: keyof RotationPreset, value: any) => {
    if (editingPreset) {
      onUpdatePreset({ ...editingPreset, [field]: value });
    }
  };
  const updateRotation = (axisIndex: number, degrees: number) => {
    if (editingPreset) {
      const newRot = [...editingPreset.rotation] as [number, number, number];
      newRot[axisIndex] = (degrees * Math.PI) / 180;
      onUpdatePreset({ ...editingPreset, rotation: newRot });
    }
  };

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
                        onClick={() => setShowSettings(true)}
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
            
            <div className="flex justify-between">
              <span>{t.resetRot}</span>
              <span className="font-mono text-white bg-gray-700 px-1 rounded">SPACE</span>
            </div>
          </div>
        </div>
      </div>

      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center pointer-events-auto">
            <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-[800px] h-[500px] flex overflow-hidden">
                {/* Sidebar List */}
                <div className="w-1/3 bg-gray-900 border-r border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <h2 className="text-white font-bold">{t.presets}</h2>
                        <button onClick={() => {onAddPreset(); setEditingId(null);}} className="text-blue-400 hover:text-blue-300 text-xs uppercase font-bold">{t.add}</button>
                    </div>
                    <div className="overflow-y-auto flex-1">
                        {presets.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setEditingId(p.id)}
                                className={`w-full text-left px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors flex justify-between items-center ${editingId === p.id ? 'bg-gray-800 border-l-4 border-l-blue-500' : ''}`}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-xl">{p.icon}</span>
                                    <span className="text-gray-300 text-sm">{t[p.name as keyof typeof t] || p.name}</span>
                                </div>
                                <span className="text-gray-600 text-xs font-mono border border-gray-700 px-1 rounded">{p.shortcut}</span>
                            </button>
                        ))}
                    </div>
                    <div className="p-4 border-t border-gray-700 text-center">
                         <button onClick={onResetPresets} className="text-red-500 hover:text-red-400 text-xs">{t.reset}</button>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="flex-1 p-8 bg-gray-800 flex flex-col relative">
                    <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white">✕</button>
                    
                    {editingPreset ? (
                        <div className="flex flex-col gap-6">
                            <h3 className="text-xl text-white font-bold mb-2">{t.presetEditor}</h3>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase mb-1">{t.name}</label>
                                    <input 
                                        type="text" 
                                        value={editingPreset.name} 
                                        onChange={(e) => updateEditingValue('name', e.target.value)}
                                        className="bg-gray-900 border border-gray-700 text-white rounded px-3 py-2 w-full focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase mb-1">{t.shortcut}</label>
                                    <input 
                                        type="text" 
                                        maxLength={1}
                                        value={editingPreset.shortcut} 
                                        onChange={(e) => updateEditingValue('shortcut', e.target.value)}
                                        className="bg-gray-900 border border-gray-700 text-white rounded px-3 py-2 w-full focus:border-blue-500 outline-none text-center font-mono"
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-500 text-xs uppercase mb-1">{t.icon}</label>
                                    <input 
                                        type="text" 
                                        value={editingPreset.icon} 
                                        onChange={(e) => updateEditingValue('icon', e.target.value)}
                                        className="bg-gray-900 border border-gray-700 text-white rounded px-3 py-2 w-full focus:border-blue-500 outline-none text-center"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 border-t border-gray-700 pt-6 mt-2">
                                {[
                                    { label: 'Rotate X (Pitch)', idx: 0 },
                                    { label: 'Rotate Y (Yaw)', idx: 1 },
                                    { label: 'Rotate Z (Roll)', idx: 2 },
                                ].map((axis) => {
                                    const deg = Math.round((editingPreset.rotation[axis.idx] * 180) / Math.PI);
                                    return (
                                        <div key={axis.idx}>
                                            <div className="flex justify-between text-gray-400 text-xs mb-1">
                                                <span>{axis.label}</span>
                                                <span>{deg}°</span>
                                            </div>
                                            <input 
                                                type="range" 
                                                min="0" 
                                                max="360" 
                                                value={deg} 
                                                onChange={(e) => updateRotation(axis.idx, parseInt(e.target.value))}
                                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <button 
                                onClick={() => onDeletePreset(editingPreset.id)}
                                className="mt-auto self-end text-red-500 text-sm hover:underline"
                            >
                                {t.delete}
                            </button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">
                            Select a preset to edit
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

export default UIOverlay;
