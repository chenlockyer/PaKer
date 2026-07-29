/// <reference lib="dom" />
import React from 'react';
import { AppTheme } from '../types';
import { translations } from '../utils/translations';

interface MainMenuProps {
  onStartChallenge: () => void;
  onStartFree: () => void;
  onLoad: () => void;
  onSettings: () => void;
  onOpenLevelStudio: () => void;
  hasSave: boolean;
  lang: 'en' | 'zh';
  theme: AppTheme;
}

const CardHouseMark = () => (
  <div className="menu-card-house" aria-hidden="true">
    <div className="menu-playing-card menu-card-left"><span>A</span><i>♥</i></div>
    <div className="menu-playing-card menu-card-right"><span>K</span><i>♠</i></div>
    <div className="menu-playing-card menu-card-roof"><span>Q</span><i>♦</i></div>
  </div>
);

const MainMenu: React.FC<MainMenuProps> = ({
  onStartChallenge,
  onStartFree,
  onLoad,
  onSettings,
  onOpenLevelStudio,
  hasSave,
  lang,
}) => {
  const t = translations[lang];
  const copy = lang === 'zh'
    ? {
        eyebrow: '物理建造游戏',
        title: '纸牌建筑师',
        lead: '用真实物理搭起一座纸牌屋，再让风和重物检验它。',
        challenge: '开始挑战',
        challengeHint: '循序完成结构目标与稳定性测试',
        free: '自由搭建',
        load: '继续上次搭建',
        settings: '设置',
        cards: '真实比例纸牌',
        physics: '实时物理反馈',
        presets: '14 种建造预设',
      }
    : {
        eyebrow: 'PHYSICS BUILDING GAME',
        title: 'Card Architect',
        lead: 'Build with realistic cards, then put the structure through wind and impact tests.',
        challenge: 'Start Challenge',
        challengeHint: 'Learn structures through progressive stability trials',
        free: 'Free Build',
        load: 'Continue Build',
        settings: 'Settings',
        cards: 'Real card proportions',
        physics: 'Live physics feedback',
        presets: '14 building presets',
      };

  return (
    <main className="menu-screen">
      <div className="menu-grid" aria-hidden="true" />
      <section className="menu-hero">
        <div className="menu-brand">
          <span className="brand-pip" />
          <span>HOUSE OF CARDS</span>
        </div>
        <div className="menu-copy">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <p className="menu-lead">{copy.lead}</p>
        </div>
        <CardHouseMark />
        <div className="menu-features">
          <span>{copy.cards}</span>
          <span>{copy.physics}</span>
          <span>{copy.presets}</span>
        </div>
      </section>

      <section className="menu-actions" aria-label={lang === 'zh' ? '游戏模式' : 'Game modes'}>
        <div className="menu-actions-header">
          <span className="section-index">01</span>
          <div>
            <p>{lang === 'zh' ? '选择模式' : 'SELECT MODE'}</p>
            <small>{lang === 'zh' ? '随时可以返回主菜单' : 'You can return here at any time'}</small>
          </div>
        </div>

        <button className="menu-action menu-action-primary" onClick={onStartChallenge}>
          <span>
            <strong>{copy.challenge}</strong>
            <small>{copy.challengeHint}</small>
          </span>
          <b aria-hidden="true">→</b>
        </button>
        <button className="menu-action" onClick={onStartFree}>
          <span>
            <strong>{copy.free}</strong>
            <small>{t.freeBuild}</small>
          </span>
          <b aria-hidden="true">02</b>
        </button>
        <button className="menu-action" onClick={onLoad} disabled={!hasSave}>
          <span>
            <strong>{copy.load}</strong>
            <small>{hasSave ? t.continueGame : (lang === 'zh' ? '暂无存档' : 'No saved build')}</small>
          </span>
          <b aria-hidden="true">03</b>
        </button>
        <button className="menu-action" onClick={onOpenLevelStudio}>
          <span>
            <strong>{lang === 'zh' ? '关卡编辑器' : 'Level Studio'}</strong>
            <small>{lang === 'zh' ? '创建、测试与导出自定义关卡' : 'Create, playtest, and export levels'}</small>
          </span>
          <b aria-hidden="true">04</b>
        </button>

        <div className="menu-secondary">
          <button className="text-button" onClick={onSettings}>{copy.settings}</button>
          <span>v1.2</span>
        </div>
      </section>
    </main>
  );
};

export default MainMenu;
