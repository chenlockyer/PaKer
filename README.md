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
    *   **时间暂停 (`L`)**: 冻结所有物体的物理状态，在“真空”中进行构思与搭建。
    *   **恢复物理**: 一键解除冻结，看重力如何决定你结构的命运。
*   **🛠️ 双重建造系统**:
    *   **快速模式 (Quick Mode)**: 智能表面吸附，跟随鼠标指引，适合大规模快速成型。
    *   **精准模式 (Precision Mode)**: 引入专业级 Gizmo 坐标轴控制（平移与旋转），实现毫米级的建筑对齐。
*   **🔄 深度旋转控制**: 支持 3 轴（偏航、俯仰、翻滚）微调，并内置 10 种快捷旋转预设（快捷键 1-0）。
*   **� 持久化管理**: 内置存档/读档功能，支持自定义旋转预设，所有的创作和偏好都会同步到 `localStorage`。

### 🎮 操作指南

#### 全局快捷键
| 按键 | 功能描述 |
| :--- | :--- |
| **L** | **冻结 / 恢复时间** (Toggle Physics) |
| **TAB** | **切换模式** (快速放置 / 精准编辑) |
| **Delete** | 进入 **删除模式** |
| **Esc** | 返回 **放置模式** |
| **Space** | **重置** 当前旋转旋转偏移量 |

#### 建造控制
*   **普通点击**: 放置纸牌
*   **Q / E**: 水平旋转 (Yaw)
*   **R / F**: 前后倾斜 (Pitch)
*   **Z / X**: 左右翻滚 (Roll)
*   **Shift + 滚轮**: 细粒度旋转微调
*   **Enter**: (精准模式下) 确认放置

#### 旋转预设 (快捷键 1-0)
*   `1`: 水平平放 | `2`: 横立 | `3`: 侧立 | `4`: 竖立
*   `5-8`: 各个方向的斜向支撑 (20°)
*   `9-0`: 屋顶斜角预设 (45°)

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
3.  **Start development server**:
    ```bash
    npm run dev
    ```

---

## 🎨 UI & Design
The interface is designed to be minimal yet powerful, featuring a sleek dark theme, responsive layouts, and a native language toggle (CN/EN) for global accessibility.

## 📄 License
Distributed under the MIT License. See [LICENSE](LICENSE) for more information.