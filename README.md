# 🃏 PaKer (House of Cards 3D)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r181-black.svg)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF.svg)](https://vitejs.dev/)

**PaKer** 是一款基于物理引擎的 3D 纸牌建筑沙盒游戏。在这里，你可以利用物理规则，用一张张扑克牌构建出令人惊叹的复杂结构，或者在瞬间见证它们的坍塌。

[简体中文](#-简体中文) | [English](#-english)

---

## 🇨🇳 简体中文

### 📖 项目简介

**PaKer**（纸牌屋 3D）是一个结合了物理模拟与 3D 建模技术的创意实验场。它不仅仅是一个游戏，更是一个探索平衡、结构与重力的数字工具。无论是为了挑战搭建世界最高的纸牌塔，还是为了创造独特的几何艺术，PaKer 都为你提供了极致的操控感。

![游戏演示截图](docs/screenshots/demo.png)

### ✨ 核心特性

*   **🧪 动力学物理模拟**: 核心由 `cannon-es` 驱动。每张纸牌都拥有真实的质量、摩擦系数以及碰撞体，模拟真实世界中的物理反馈。
*   **⏳ 时间操控艺术**: 
    *   **时间暂停 (`F`)**: 冻结所有物体的物理状态，在“真空”中进行构思与搭建。
    *   **恢复物理**: 一键解除冻结，看重力如何决定你结构的命运。
*   **🛠️ 双重建造系统**:
    *   **快速模式 (Quick Mode)**: 智能表面吸附，跟随鼠标指引，适合大规模快速成型。
    *   **精准模式 (Precision Mode)**: 引入专业级 Gizmo 坐标轴控制（平移与旋转），实现毫米级的建筑对齐。
*   **🔄 深度旋转控制**: 使用左手六键调整偏航、前后倾和左右倾，并通过姿态轮盘快速选择放置预设。
*   **� 持久化管理**: 内置存档/读档功能，支持自定义旋转预设，所有的创作和偏好都会同步到 `localStorage`。

### 🎮 操作指南

#### 全局快捷键
| 按键 | 功能描述 |
| :--- | :--- |
| **1 / 2 / 3** | 切换 **放置 / 移动 / 删除** 工具 |
| **F** | **冻结 / 恢复物理** |
| **Tab** | 切换 **快速放置 / 精准编辑** |
| **Ctrl + Z / Ctrl + Y** | **撤销 / 重做** |
| **Esc** | 取消当前操作 |

#### 建造控制
*   **左键**: 放置、选择和确认
*   **右键拖动 / 中键拖动 / 滚轮**: 旋转镜头 / 平移镜头 / 缩放
*   **Q / E**: 水平左转 / 右转
*   **W / S**: 后倾 / 前倾
*   **A / D**: 左倾 / 右倾
*   **R**: 恢复当前预设旋转
*   **按住 Space**: 锁定当前高度

## 蓝图工作台

在自由搭建或关卡界面点击顶部的 **蓝图**，可以把场景中每张牌此刻的真实物理位置和姿态捕获为结构蓝图。蓝图与普通游戏存档相互独立，支持：

*   录制后续放置的卡牌并自动生成步骤
*   编辑步骤时间线、卡牌分组、说明、推荐预设与镜头提示
*   设置位置、旋转和接近提示容差
*   将蓝图投影到场景，选择原点和方向并逐步搭建
*   实时判定位置、姿态和接地边，显示步骤进度并支持失败恢复
*   蓝图搭建不覆盖物理状态，所有卡牌统一服从场景“物理”开关
*   四个循序解锁的官方教学：A 字架、双 A 字支撑、横梁和一层纸牌屋
*   完整结构、当前步骤、关键牌三档投影辅助，课程完成状态会自动保存
*   保存草稿、发布、从头测试、导入和导出
*   **Ctrl / Alt + 旋转键**: 1° 精调 / 45° 快速调整
*   **Enter**: 精准模式确认放置

#### 放置预设

*   **按住 C**: 打开鼠标姿态轮盘，松开应用所选预设
*   **Shift + Q / Shift + E**: 切换上一个 / 下一个预设
*   设置中可以切换回旧版键位，或重新绑定任意操作

---

## 🇺🇸 English

### 📖 Overview

**PaKer** (House of Cards 3D) is a physics-based construction sandbox that merges engineering principles with creative freedom. Build intricate card structures using realistic physics or defy the laws of nature with time-manipulation tools.

### ✨ Key Features

*   **Realistic Physics**: Cards have volume, mass, and friction, calculation is powered by `cannon-es`.
*   **Time Control**: Freeze space to build gravity-defying architectures, then unfreeze to let physics take its course.
*   **Hybrid Workflow**: Switch between effortless **Quick Build** and pixel-perfect **Precision Mode** with industry-standard Gizmos.
*   **Configurable**: Customize your own rotation presets and save your progress locally.

### 🛠 Tech Stack

- **UI Framework**: React 19 + TypeScript
- **3D Graphics**: React Three Fiber (Three.js)
- **Physics**: React Three Cannon
- **State & Persistence**: React Hooks + LocalStorage
- **Bundler**: Vite

### 🚀 Getting Started

1.  **Clone** this repository.
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Start the desktop development build**:
    ```bash
    npm run dev
    ```

### 🖥️ Desktop Commands

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Start Vite and the Electron desktop window with hot reload |
| `npm run dev:web` | Start the browser development server only |
| `npm run build` | Build the production renderer into `dist/` |
| `npm run desktop` | Build and launch the production desktop app |
| `npm run pack:win` | Generate an unpacked Windows app in `release/win-unpacked/` |
| `npm run dist:win` | Generate the Windows installer in `release/` |

The production desktop shell uses context isolation, renderer sandboxing, disabled
Node integration, denied browser permissions, and restricted external navigation.
Press `F11` or `Alt + Enter` to toggle fullscreen, and `Esc` to leave fullscreen.

---

## 🎨 UI & Design
The interface is designed to be minimal yet powerful, featuring a sleek dark theme, responsive layouts, and a native language toggle (CN/EN) for global accessibility.

## 📄 License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.
