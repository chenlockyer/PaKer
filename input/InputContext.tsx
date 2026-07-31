import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type InputAction =
  | 'tool.place'
  | 'tool.push'
  | 'tool.delete'
  | 'tool.launch'
  | 'launch.presetPrevious'
  | 'launch.presetNext'
  | 'mode.togglePrecision'
  | 'card.yawLeft'
  | 'card.yawRight'
  | 'card.tiltForward'
  | 'card.tiltBackward'
  | 'card.tiltLeft'
  | 'card.tiltRight'
  | 'card.resetRotation'
  | 'card.lockHeight'
  | 'preset.radial'
  | 'preset.previous'
  | 'preset.next'
  | 'preset.slot1'
  | 'preset.slot2'
  | 'preset.slot3'
  | 'preset.slot4'
  | 'preset.slot5'
  | 'preset.slot6'
  | 'preset.slot7'
  | 'preset.slot8'
  | 'preset.slot9'
  | 'preset.slot0'
  | 'physics.toggle'
  | 'history.undo'
  | 'history.redo'
  | 'precision.translate'
  | 'precision.rotate'
  | 'action.confirm'
  | 'action.cancel';

export type InputProfile = 'recommended' | 'legacy' | 'custom';

export interface KeyBinding {
  code: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}

export interface InputActionEvent {
  action: InputAction;
  phase: 'down' | 'up';
  binding: KeyBinding;
  originalEvent: KeyboardEvent;
}

export const ACTIONS: InputAction[] = [
  'tool.place',
  'tool.push',
  'tool.delete',
  'tool.launch',
  'launch.presetPrevious',
  'launch.presetNext',
  'mode.togglePrecision',
  'card.yawLeft',
  'card.yawRight',
  'card.tiltForward',
  'card.tiltBackward',
  'card.tiltLeft',
  'card.tiltRight',
  'card.resetRotation',
  'card.lockHeight',
  'preset.radial',
  'preset.previous',
  'preset.next',
  'preset.slot1',
  'preset.slot2',
  'preset.slot3',
  'preset.slot4',
  'preset.slot5',
  'preset.slot6',
  'preset.slot7',
  'preset.slot8',
  'preset.slot9',
  'preset.slot0',
  'physics.toggle',
  'history.undo',
  'history.redo',
  'precision.translate',
  'precision.rotate',
  'action.confirm',
  'action.cancel',
];

export const RECOMMENDED_BINDINGS: Record<InputAction, KeyBinding> = {
  'tool.place': { code: 'Digit1' },
  'tool.push': { code: 'Digit2' },
  'tool.delete': { code: 'Digit3' },
  'tool.launch': { code: 'Digit4' },
  'launch.presetPrevious': { code: 'KeyQ' },
  'launch.presetNext': { code: 'KeyE' },
  'mode.togglePrecision': { code: 'Tab' },
  'card.yawLeft': { code: 'KeyQ' },
  'card.yawRight': { code: 'KeyE' },
  'card.tiltForward': { code: 'KeyS' },
  'card.tiltBackward': { code: 'KeyW' },
  'card.tiltLeft': { code: 'KeyA' },
  'card.tiltRight': { code: 'KeyD' },
  'card.resetRotation': { code: 'KeyR' },
  'card.lockHeight': { code: 'Space' },
  'preset.radial': { code: 'KeyC' },
  'preset.previous': { code: 'KeyQ', shift: true },
  'preset.next': { code: 'KeyE', shift: true },
  'preset.slot1': { code: '' },
  'preset.slot2': { code: '' },
  'preset.slot3': { code: '' },
  'preset.slot4': { code: '' },
  'preset.slot5': { code: '' },
  'preset.slot6': { code: '' },
  'preset.slot7': { code: '' },
  'preset.slot8': { code: '' },
  'preset.slot9': { code: '' },
  'preset.slot0': { code: '' },
  'physics.toggle': { code: 'KeyF' },
  'history.undo': { code: 'KeyZ', ctrl: true },
  'history.redo': { code: 'KeyY', ctrl: true },
  'precision.translate': { code: 'KeyW' },
  'precision.rotate': { code: 'KeyE' },
  'action.confirm': { code: 'Enter' },
  'action.cancel': { code: 'Escape' },
};

export const LEGACY_BINDINGS: Record<InputAction, KeyBinding> = {
  ...RECOMMENDED_BINDINGS,
  'tool.place': { code: 'Escape' },
  'tool.push': { code: 'KeyM' },
  'tool.delete': { code: 'Delete' },
  'tool.launch': { code: 'KeyG' },
  'card.tiltForward': { code: 'KeyR' },
  'card.tiltBackward': { code: 'KeyF' },
  'card.tiltLeft': { code: 'KeyZ' },
  'card.tiltRight': { code: 'KeyX' },
  'card.resetRotation': { code: 'Space' },
  'card.lockHeight': { code: 'KeyH' },
  'physics.toggle': { code: 'KeyL' },
  'precision.translate': { code: 'KeyT' },
  'precision.rotate': { code: 'KeyR' },
  'preset.slot1': { code: 'Digit1' },
  'preset.slot2': { code: 'Digit2' },
  'preset.slot3': { code: 'Digit3' },
  'preset.slot4': { code: 'Digit4' },
  'preset.slot5': { code: 'Digit5' },
  'preset.slot6': { code: 'Digit6' },
  'preset.slot7': { code: 'Digit7' },
  'preset.slot8': { code: 'Digit8' },
  'preset.slot9': { code: 'Digit9' },
  'preset.slot0': { code: 'Digit0' },
};

const STORAGE_KEY = 'hoc_input_settings_v1';
const INPUT_SCHEMA_VERSION = 6;
type Listener = (event: InputActionEvent) => void;

interface StoredInputSettings {
  version: number;
  profile: InputProfile;
  bindings: Record<InputAction, KeyBinding>;
}

interface InputContextValue {
  profile: InputProfile;
  bindings: Record<InputAction, KeyBinding>;
  setProfile: (profile: Exclude<InputProfile, 'custom'>) => void;
  setBinding: (action: InputAction, binding: KeyBinding) => void;
  resetBindings: () => void;
  formatBinding: (action: InputAction) => string;
  findConflict: (action: InputAction, binding: KeyBinding) => InputAction | null;
  subscribe: (action: InputAction, listener: Listener) => () => void;
  isPressed: (action: InputAction) => boolean;
  setSuspended: (suspended: boolean) => void;
}

const InputContext = createContext<InputContextValue | null>(null);

const cloneBindings = (
  bindings: Record<InputAction, KeyBinding>,
): Record<InputAction, KeyBinding> => JSON.parse(JSON.stringify(bindings));

const loadSettings = (): StoredInputSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: INPUT_SCHEMA_VERSION, profile: 'recommended', bindings: cloneBindings(RECOMMENDED_BINDINGS) };
    }
    const parsed = JSON.parse(raw) as Partial<StoredInputSettings>;
    const profile = parsed.profile ?? 'recommended';
    if (profile === 'recommended' && parsed.version !== INPUT_SCHEMA_VERSION) {
      return { version: INPUT_SCHEMA_VERSION, profile, bindings: cloneBindings(RECOMMENDED_BINDINGS) };
    }
    const defaults = profile === 'legacy' ? LEGACY_BINDINGS : RECOMMENDED_BINDINGS;
    const storedBindings = {
      ...((parsed.bindings ?? {}) as Record<string, KeyBinding>),
    };
    // v5 and earlier called free push "move". Preserve custom bindings.
    if (!storedBindings['tool.push'] && storedBindings['tool.move']) {
      storedBindings['tool.push'] = storedBindings['tool.move'];
    }
    delete storedBindings['tool.move'];
    return {
      version: INPUT_SCHEMA_VERSION,
      profile,
      bindings: {
        ...cloneBindings(defaults),
        ...storedBindings,
      },
    };
  } catch {
    return { version: INPUT_SCHEMA_VERSION, profile: 'recommended', bindings: cloneBindings(RECOMMENDED_BINDINGS) };
  }
};

const bindingSpecificity = (binding: KeyBinding) =>
  Number(Boolean(binding.ctrl)) + Number(Boolean(binding.shift)) + Number(Boolean(binding.alt));

const hasRequiredModifiers = (event: KeyboardEvent, binding: KeyBinding) =>
  (!binding.ctrl || event.ctrlKey) &&
  (!binding.shift || event.shiftKey) &&
  (!binding.alt || event.altKey);

const sameBinding = (left: KeyBinding, right: KeyBinding) =>
  left.code === right.code &&
  Boolean(left.ctrl) === Boolean(right.ctrl) &&
  Boolean(left.shift) === Boolean(right.shift) &&
  Boolean(left.alt) === Boolean(right.alt);

const isEditableElement = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]'),
  );
};

const isEditableEvent = (event: Event) => {
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [event.target];
  return path.some(isEditableElement);
};

const hasEditableFocus = () =>
  typeof document !== 'undefined' && isEditableElement(document.activeElement);

export const keyBindingFromEvent = (event: React.KeyboardEvent | KeyboardEvent): KeyBinding => ({
  code: event.code,
  ctrl: event.ctrlKey || undefined,
  shift: event.shiftKey || undefined,
  alt: event.altKey || undefined,
});

const CODE_LABELS: Record<string, string> = {
  Space: 'Space',
  Escape: 'Esc',
  Delete: 'Del',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

export const formatKeyBinding = (binding: KeyBinding) => {
  const key =
    CODE_LABELS[binding.code] ??
    binding.code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
  return [
    binding.ctrl ? 'Ctrl' : '',
    binding.shift ? 'Shift' : '',
    binding.alt ? 'Alt' : '',
    key,
  ]
    .filter(Boolean)
    .join(' + ');
};

export const InputProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initial = useMemo(loadSettings, []);
  const [profile, setProfileState] = useState<InputProfile>(initial.profile);
  const [bindings, setBindings] = useState<Record<InputAction, KeyBinding>>(initial.bindings);
  const bindingsRef = useRef(bindings);
  const listenersRef = useRef(new Map<InputAction, Set<Listener>>());
  const pressedRef = useRef(new Set<InputAction>());
  const suspendedRef = useRef(false);

  useEffect(() => {
    bindingsRef.current = bindings;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: INPUT_SCHEMA_VERSION, profile, bindings }),
    );
  }, [bindings, profile]);

  const releaseAll = useCallback(() => {
    const pressed = [...pressedRef.current];
    pressedRef.current.clear();
    pressed.forEach(action => {
      const binding = bindingsRef.current[action];
      const synthetic = new KeyboardEvent('keyup', { code: binding.code });
      listenersRef.current.get(action)?.forEach(listener =>
        listener({ action, phase: 'up', binding, originalEvent: synthetic }),
      );
    });
  }, []);

  useEffect(() => {
    let isComposingText = false;

    const resolveActions = (event: KeyboardEvent) => {
      const candidates = ACTIONS.filter(action => {
        const binding = bindingsRef.current[action];
        return binding.code === event.code && hasRequiredModifiers(event, binding);
      });
      const maxSpecificity = Math.max(-1, ...candidates.map(action => bindingSpecificity(bindingsRef.current[action])));
      return candidates.filter(action => bindingSpecificity(bindingsRef.current[action]) === maxSpecificity);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        suspendedRef.current ||
        isEditableEvent(event) ||
        hasEditableFocus() ||
        isComposingText ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.repeat
      ) return;
      const actions = resolveActions(event);
      if (actions.length === 0) return;
      event.preventDefault();
      actions.forEach(action => {
        pressedRef.current.add(action);
        const binding = bindingsRef.current[action];
        listenersRef.current.get(action)?.forEach(listener =>
          listener({ action, phase: 'down', binding, originalEvent: event }),
        );
      });
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (
        suspendedRef.current ||
        isEditableEvent(event) ||
        hasEditableFocus() ||
        isComposingText ||
        event.isComposing ||
        event.keyCode === 229
      ) return;
      const actions = ACTIONS.filter(
        action =>
          pressedRef.current.has(action) &&
          bindingsRef.current[action].code === event.code,
      );
      if (actions.length === 0) return;
      event.preventDefault();
      actions.forEach(action => {
        pressedRef.current.delete(action);
        const binding = bindingsRef.current[action];
        listenersRef.current.get(action)?.forEach(listener =>
          listener({ action, phase: 'up', binding, originalEvent: event }),
        );
      });
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (isEditableEvent(event)) releaseAll();
    };

    const handleCompositionStart = (event: CompositionEvent) => {
      if (!isEditableEvent(event) && !hasEditableFocus()) return;
      isComposingText = true;
      releaseAll();
    };

    const handleCompositionEnd = () => {
      isComposingText = false;
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('blur', releaseAll);
    window.addEventListener('focusin', handleFocusIn, true);
    window.addEventListener('compositionstart', handleCompositionStart, true);
    window.addEventListener('compositionend', handleCompositionEnd, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('blur', releaseAll);
      window.removeEventListener('focusin', handleFocusIn, true);
      window.removeEventListener('compositionstart', handleCompositionStart, true);
      window.removeEventListener('compositionend', handleCompositionEnd, true);
    };
  }, [releaseAll]);

  const subscribe = useCallback((action: InputAction, listener: Listener) => {
    const listeners = listenersRef.current.get(action) ?? new Set<Listener>();
    listeners.add(listener);
    listenersRef.current.set(action, listeners);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const setProfile = useCallback((nextProfile: Exclude<InputProfile, 'custom'>) => {
    setProfileState(nextProfile);
    setBindings(cloneBindings(nextProfile === 'legacy' ? LEGACY_BINDINGS : RECOMMENDED_BINDINGS));
    releaseAll();
  }, [releaseAll]);

  const setBinding = useCallback((action: InputAction, binding: KeyBinding) => {
    setProfileState('custom');
    setBindings(previous => ({ ...previous, [action]: binding }));
    releaseAll();
  }, [releaseAll]);

  const resetBindings = useCallback(() => {
    setProfile('recommended');
  }, [setProfile]);

  const findConflict = useCallback(
    (action: InputAction, binding: KeyBinding) =>
      ACTIONS.find(candidate => candidate !== action && sameBinding(bindings[candidate], binding)) ?? null,
    [bindings],
  );

  const value = useMemo<InputContextValue>(
    () => ({
      profile,
      bindings,
      setProfile,
      setBinding,
      resetBindings,
      formatBinding: action => formatKeyBinding(bindings[action]),
      findConflict,
      subscribe,
      isPressed: action => pressedRef.current.has(action),
      setSuspended: suspended => {
        suspendedRef.current = suspended;
        if (suspended) releaseAll();
      },
    }),
    [bindings, findConflict, profile, releaseAll, resetBindings, setBinding, setProfile, subscribe],
  );

  return <InputContext.Provider value={value}>{children}</InputContext.Provider>;
};

export const useInput = () => {
  const value = useContext(InputContext);
  if (!value) throw new Error('useInput must be used inside InputProvider');
  return value;
};

export const useInputAction = (action: InputAction, listener: Listener) => {
  const { subscribe } = useInput();
  const listenerRef = useRef(listener);
  useEffect(() => {
    listenerRef.current = listener;
  }, [listener]);
  useEffect(
    () => subscribe(action, event => listenerRef.current(event)),
    [action, subscribe],
  );
};
