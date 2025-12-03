# 🃏 House of Cards 3D (纸牌屋 3D)

A physics-based 3D construction sandbox game where you build complex structures using playing cards. Features realistic physics simulation, multiple control modes, and architectural freedom.

一款基于物理的 3D 建造沙盒游戏，你可以使用扑克牌搭建复杂的结构。拥有真实的物理模拟、多种操控模式和极高的建筑自由度。

## ✨ Features (特色功能)

*   **Realistic Physics (真实物理)**: Powered by `cannon-es`, cards have weight, friction, and collision.
*   **Three Interaction Modes (三种交互模式)**:
    *   **Place (放置)**: Build your structure with ghost previews.
    *   **Move (移动)**: Drag and adjust existing cards (physics temporarily suspended during drag).
    *   **Delete (删除)**: Click to remove unwanted cards.
*   **Dual Building Styles (双重建造风格)**:
    *   **Quick Mode**: Snaps to surfaces, follows mouse cursor.
    *   **Precision Mode**: Blender-style gizmos (Translate/Rotate) for pixel-perfect positioning.
*   **Time Control (时间控制)**: Freeze time (`L`) to lock all cards in static space. Build impossible structures floating in air, then unfreeze to let gravity take over.
*   **Advanced Rotation (高级旋转)**: Full 3-axis control (Yaw, Pitch, Roll) plus 10 instant presets.
*   **Performance (性能优化)**: Optimized raycasting and physics sleeping mechanisms for smooth performance even with many cards.

## 🎮 Controls (操作指南)

### Global Shortcuts (全局快捷键)
| Key (按键) | Action (功能) |
| :--- | :--- |
| **L** | Toggle Freeze / Time Stop (时间暂停/恢复) |
| **TAB** | Switch Quick / Precision Mode (切换快速/精准模式) |
| **Delete / Backspace** | Enter Delete Mode (进入删除模式) |
| **Esc** | Return to Place Mode (返回放置模式) |
| **Space** | Reset Rotation Offsets (重置旋转微调) |

### Rotation Presets (旋转预设)
| Key | Preset | Key | Preset |
| :--- | :--- | :--- | :--- |
| **1** | Flat (平放) | **6** | Lean Back (后倾 ~20°) |
| **2** | Stand X (横立) | **7** | Lean Left (左倾 ~20°) |
| **3** | Stand Y (侧立) | **8** | Lean Right (右倾 ~20°) |
| **4** | Stand Z (竖立) | **9** | Roof Forward (前屋顶 ~45°) |
| **5** | Lean Fwd (前倾 ~20°) | **0** | Roof Back (后屋顶 ~45°) |

### Quick Place Controls (快速放置控制)
*   **Mouse Move**: Aim card.
*   **Left Click**: Place card.
*   **Q / E**: Rotate Yaw (水平旋转).
*   **R / F**: Tilt Pitch (前后倾斜).
*   **Z / X**: Roll (左右翻滚).
*   **Scroll Wheel**: Fine-tune Yaw (微调旋转).

### Precision Mode Controls (精准模式控制)
*   **T**: Translate Tool (平移工具).
*   **R**: Rotate Tool (旋转工具).
*   **Enter**: Confirm Placement (确认放置).
*   **Mouse Drag**: Move Gizmo handles (拖拽坐标轴).

### Management (管理)
*   **Language**: Toggle EN/中文 via the top-right button.
*   **Clear Table**: Remove all cards.

## 🛠 Tech Stack

*   **Framework**: React 19, TypeScript, Tailwind CSS
*   **3D Engine**: React Three Fiber (Three.js)
*   **Physics**: React Three Cannon (Cannon-es)
*   **Helpers**: React Three Drei
*   **Build Tool**: Vite

## 🚀 Getting Started

1.  Clone the repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Run development server:
    ```bash
    npm run dev
    ```
