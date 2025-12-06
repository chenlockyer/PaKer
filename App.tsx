
/// <reference lib="dom" />
import React, { useState, useCallback, useEffect } from 'react';
import GameScene from './components/GameScene';
import UIOverlay from './components/UIOverlay';
import MainMenu from './components/MainMenu';
import SettingsModal from './components/SettingsModal';
import { CardData, RotationPreset, InteractionMode, PointerMode, AppState } from './types';
import { translations } from './utils/translations';

const DEFAULT_PRESETS: RotationPreset[] = [
  { id: 'flat', name: 'flat', icon: '▀', shortcut: '1', rotation: [0, 0, 0] },
  { id: 'stand_x', name: 'standX', icon: '▮', shortcut: '2', rotation: [Math.PI / 2, 0, 0] }, // Short edge down
  { id: 'stand_y', name: 'standY', icon: '▬', shortcut: '3', rotation: [Math.PI / 2, Math.PI / 2, 0] },
  { id: 'stand_z', name: 'standZ', icon: '▎', shortcut: '4', rotation: [0, 0, Math.PI / 2] }, // Long edge down

  // 5 & 6: Lean Fwd/Back -> Long Edge on Ground (Landscape)
  // Base: Stand Z (0, 0, PI/2).
  // Tilt: Rotate Z.
  // 5 (Fwd): Face down (100 deg) -> PI/2 + 0.175
  // 6 (Back): Face up (80 deg) -> PI/2 - 0.175
  { id: 'lean_fwd', name: 'leanFwd', icon: '◢', shortcut: '5', rotation: [0, 0, Math.PI / 2 + 0.175] },
  { id: 'lean_back', name: 'leanBack', icon: '◣', shortcut: '6', rotation: [0, 0, Math.PI / 2 - 0.175] },

  // 7 & 8: Lean Left/Right -> Short Edge on Ground (Portrait)
  // Base: Stand X (PI/2, 0, 0).
  // Tilt: Rotate Z (Side Lean/Roll).
  { id: 'lean_left', name: 'leanLeft', icon: '◤', shortcut: '7', rotation: [Math.PI / 2, 0, 0.175] },
  { id: 'lean_right', name: 'leanRight', icon: '◥', shortcut: '8', rotation: [Math.PI / 2, 0, -0.175] },

  { id: 'roof_fwd', name: 'roofFwd', icon: '▲', shortcut: '9', rotation: [Math.PI / 2 - 0.78, 0, 0] },
  { id: 'roof_back', name: 'roofBack', icon: '▼', shortcut: '0', rotation: [Math.PI / 2 + 0.78, 0, 0] },
];

const App: React.FC = () => {
  // --- STATE: GLOBAL ---
  const [appState, setAppState] = useState<AppState>(AppState.MENU);
  const [showSettings, setShowSettings] = useState(false);
  const [lang, setLang] = useState<'en' | 'zh'>('zh');

  // --- STATE: GAME DATA ---
  const [presets, setPresets] = useState<RotationPreset[]>(() => {
    try {
      const saved = localStorage.getItem('hoc_presets');
      return saved ? JSON.parse(saved) : DEFAULT_PRESETS;
    } catch (e) {
      console.error("Failed to load presets", e);
      return DEFAULT_PRESETS;
    }
  });

  const [currentPresetId, setCurrentPresetId] = useState<string>(DEFAULT_PRESETS[0].id);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.QUICK);
  const [pointerMode, setPointerMode] = useState<PointerMode>(PointerMode.PLACE);
  const [isFreezeMode, setIsFreezeMode] = useState(false);
  const [cards, setCards] = useState<CardData[]>([]);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  // Persistence for Presets
  useEffect(() => {
    localStorage.setItem('hoc_presets', JSON.stringify(presets));
  }, [presets]);

  const currentPreset = presets.find(p => p.id === currentPresetId) || presets[0];

  // --- LOGIC: PRESETS ---
  const addPreset = useCallback(() => {
    const newPreset: RotationPreset = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Preset',
      icon: '★',
      shortcut: '',
      rotation: [0, 0, 0]
    };
    setPresets(prev => [...prev, newPreset]);
    setCurrentPresetId(newPreset.id);
  }, []);

  const updatePreset = useCallback((updated: RotationPreset) => {
    setPresets(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  const deletePreset = useCallback((id: string) => {
    setPresets(prev => {
      const filtered = prev.filter(p => p.id !== id);
      if (currentPresetId === id && filtered.length > 0) {
        setCurrentPresetId(filtered[0].id);
      }
      return filtered;
    });
  }, [currentPresetId]);

  const resetPresets = useCallback(() => {
    if (confirm('Reset all presets to default?')) {
      setPresets(DEFAULT_PRESETS);
      setCurrentPresetId(DEFAULT_PRESETS[0].id);
    }
  }, []);

  // --- LOGIC: CARDS ---
  const addCard = useCallback((card: CardData) => {
    const newCard = { ...card, locked: isFreezeMode };
    setCards(prev => [...prev, newCard]);
  }, [isFreezeMode]);

  const removeCard = useCallback((id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
  }, []);

  const updateCard = useCallback((id: string, position: [number, number, number], rotation: [number, number, number]) => {
    setCards(prev => prev.map(c => 
      c.id === id 
        ? { ...c, position, rotation, locked: isFreezeMode }
        : c
    ));
  }, [isFreezeMode]);

  const clearCards = useCallback(() => {
    setCards([]);
  }, []);

  // --- LOGIC: SAVE/LOAD ---
  const saveGame = useCallback(() => {
    const saveData = {
      cards,
      isFreezeMode
    };
    localStorage.setItem('hoc_save', JSON.stringify(saveData));
    alert(lang === 'zh' ? '游戏已保存' : 'Game Saved');
  }, [cards, isFreezeMode, lang]);

  const loadGame = useCallback(() => {
    try {
      const saved = localStorage.getItem('hoc_save');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.cards) {
          setCards(data.cards);
          setIsFreezeMode(!!data.isFreezeMode);
          alert(lang === 'zh' ? '游戏已读取' : 'Game Loaded');
        }
      } else {
        alert(lang === 'zh' ? '没有找到存档' : 'No save found');
      }
    } catch (e) {
      console.error(e);
      alert(lang === 'zh' ? '读取存档失败' : 'Failed to load save');
    }
  }, [lang]);

  const toggleFreezeMode = useCallback((forceVal?: boolean) => {
    setIsFreezeMode(prev => {
      const newVal = forceVal !== undefined ? forceVal : !prev;
      setCards(currentCards => currentCards.map(c => ({ ...c, locked: newVal })));
      return newVal;
    });
  }, []);

  // --- LOGIC: INPUT ---
  useEffect(() => {
    // Only handle global shortcuts in GAME mode
    if (appState !== AppState.GAME) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      // Check presets first
      const matchedPreset = presets.find(p => p.shortcut.toLowerCase() === key);
      if (matchedPreset) {
        setCurrentPresetId(matchedPreset.id);
        return;
      }

      switch(key) {
        case 'l': toggleFreezeMode(); break;
        case 'tab': 
            e.preventDefault();
            setInteractionMode(prev => prev === InteractionMode.QUICK ? InteractionMode.PRECISION : InteractionMode.QUICK);
            break;
        case 'delete':
        case 'backspace':
            setPointerMode(PointerMode.DELETE);
            break;
        case 'escape':
            setPointerMode(PointerMode.PLACE);
            break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFreezeMode, presets, appState]);

  // --- RENDER ---
  return (
    <div className="relative w-full h-screen bg-gray-900 overflow-hidden text-sans">
      
      {appState === AppState.MENU && (
        <MainMenu 
           onStart={() => {
              // Only clear if empty? Or always clear? 
              // Usually Start Game means New Game.
              // Let's prompt or just Start. For now, simple start.
              // If cards exist, maybe clear?
              setCards([]);
              setAppState(AppState.GAME);
           }}
           onLoad={() => {
              loadGame();
              setAppState(AppState.GAME);
           }}
           onSettings={() => setShowSettings(true)}
           hasSave={!!localStorage.getItem('hoc_save')}
           lang={lang}
        />
      )}

      {appState === AppState.GAME && (
        <>
          <GameScene 
            rotationPreset={currentPreset}
            interactionMode={interactionMode} 
            pointerMode={pointerMode}
            isFreezeMode={isFreezeMode}
            cards={cards} 
            addCard={addCard} 
            removeCard={removeCard}
            updateCard={updateCard}
            draggingCardId={draggingCardId}
            setDraggingCardId={setDraggingCardId}
          />
          
          <UIOverlay 
            presets={presets}
            currentPresetId={currentPresetId}
            setPresetId={setCurrentPresetId}
            interactionMode={interactionMode}
            setInteractionMode={setInteractionMode}
            pointerMode={pointerMode}
            setPointerMode={setPointerMode}
            isFreezeMode={isFreezeMode}
            setIsFreezeMode={() => toggleFreezeMode()}
            onClear={clearCards}
            onSave={saveGame}
            onLoad={loadGame}
            cardCount={cards.length}
            lang={lang}
            onOpenSettings={() => setShowSettings(true)}
            onBackToMenu={() => setAppState(AppState.MENU)}
          />
        </>
      )}

      {/* GLOBAL SETTINGS MODAL */}
      <SettingsModal 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        lang={lang}
        setLang={setLang}
        presets={presets}
        onAddPreset={addPreset}
        onUpdatePreset={updatePreset}
        onDeletePreset={deletePreset}
        onResetPresets={resetPresets}
      />
    </div>
  );
};

export default App;
