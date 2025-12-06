
/// <reference lib="dom" />
import React, { useState } from 'react';
import { RotationPreset } from '../types';
import { translations } from '../utils/translations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'en' | 'zh';
  setLang: (lang: 'en' | 'zh') => void;
  presets: RotationPreset[];
  onAddPreset: () => void;
  onUpdatePreset: (preset: RotationPreset) => void;
  onDeletePreset: (id: string) => void;
  onResetPresets: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  lang,
  setLang,
  presets,
  onAddPreset,
  onUpdatePreset,
  onDeletePreset,
  onResetPresets
}) => {
  if (!isOpen) return null;

  const t = translations[lang];
  const [activeTab, setActiveTab] = useState<'general' | 'controls' | 'presets'>('general');
  const [editingId, setEditingId] = useState<string | null>(null);

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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center pointer-events-auto">
      <div className="bg-gray-800 border border-gray-600 rounded-xl shadow-2xl w-[800px] h-[550px] flex flex-col overflow-hidden">
        
        {/* Header / Tabs */}
        <div className="bg-gray-900 border-b border-gray-700 flex justify-between items-center px-6">
          <div className="flex gap-6 h-14 items-center">
             <button onClick={() => setActiveTab('general')} className={`h-full border-b-2 font-bold px-2 ${activeTab === 'general' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>{t.general}</button>
             <button onClick={() => setActiveTab('controls')} className={`h-full border-b-2 font-bold px-2 ${activeTab === 'controls' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>{t.controls}</button>
             <button onClick={() => setActiveTab('presets')} className={`h-full border-b-2 font-bold px-2 ${activeTab === 'presets' ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'}`}>{t.presets}</button>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          
          {/* GENERAL TAB */}
          {activeTab === 'general' && (
            <div className="p-8">
               <h3 className="text-xl font-bold text-white mb-6">{t.language}</h3>
               <div className="flex gap-4">
                  <button 
                    onClick={() => setLang('zh')}
                    className={`px-6 py-3 rounded-lg border flex items-center gap-3 ${lang === 'zh' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                  >
                    <span className="text-2xl">🇨🇳</span> 中文
                  </button>
                  <button 
                    onClick={() => setLang('en')}
                    className={`px-6 py-3 rounded-lg border flex items-center gap-3 ${lang === 'en' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                  >
                    <span className="text-2xl">🇺🇸</span> English
                  </button>
               </div>
            </div>
          )}

          {/* CONTROLS TAB */}
          {activeTab === 'controls' && (
             <div className="p-8 overflow-y-auto h-full">
                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                   <div>
                      <h4 className="text-blue-400 text-sm font-bold uppercase tracking-wider mb-4">{t.place} / {t.move}</h4>
                      <ul className="space-y-3 text-gray-300 text-sm">
                         <li className="flex justify-between"><span className="text-white">Q / E</span> {t.rotateYaw}</li>
                         <li className="flex justify-between"><span className="text-white">R / F</span> {t.tiltPitch}</li>
                         <li className="flex justify-between"><span className="text-white">Z / X</span> {t.rollZ}</li>
                         <li className="flex justify-between"><span className="text-white">SPACE</span> {t.resetRot}</li>
                         <li className="flex justify-between"><span className="text-white">Mouse Wheel</span> {t.rotateYaw}</li>
                      </ul>
                   </div>
                   <div>
                      <h4 className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-4">{t.precision}</h4>
                      <ul className="space-y-3 text-gray-300 text-sm">
                         <li className="flex justify-between"><span className="text-white">T</span> {t.translate}</li>
                         <li className="flex justify-between"><span className="text-white">R</span> {t.rotate}</li>
                         <li className="flex justify-between"><span className="text-white">ENTER</span> {t.placeCard}</li>
                         <li className="flex justify-between"><span className="text-white">TAB</span> {t.togglePrecision}</li>
                      </ul>
                   </div>
                   <div>
                      <h4 className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-4">Global</h4>
                      <ul className="space-y-3 text-gray-300 text-sm">
                         <li className="flex justify-between"><span className="text-white">L</span> {t.freeze}</li>
                         <li className="flex justify-between"><span className="text-white">DEL / Backspace</span> {t.delete}</li>
                         <li className="flex justify-between"><span className="text-white">ESC</span> {t.place} Mode</li>
                      </ul>
                   </div>
                </div>
             </div>
          )}

          {/* PRESETS TAB */}
          {activeTab === 'presets' && (
            <div className="flex h-full">
                {/* Sidebar List */}
                <div className="w-1/3 bg-gray-900 border-r border-gray-700 flex flex-col">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                        <span className="text-gray-400 text-xs uppercase font-bold">List</span>
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
                <div className="flex-1 p-8 bg-gray-800 flex flex-col">
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
                            <button onClick={() => onDeletePreset(editingPreset.id)} className="mt-auto self-end text-red-500 text-sm hover:underline">{t.deletePreset}</button>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center text-gray-500">Select a preset to edit</div>
                    )}
                </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
