import React from 'react';
import { LevelDefinition } from '../types';

const CampaignResumeModal: React.FC<{ level: LevelDefinition; lang: 'zh' | 'en'; onContinue: () => void; onRestart: () => void; onChapters: () => void }> = ({ level, lang, onContinue, onRestart, onChapters }) => <div className="modal-layer campaign-resume-layer ui-scale-surface" role="dialog" aria-modal="true"><section className="campaign-resume-card"><span className="panel-kicker">{lang === 'zh' ? '未完成的挑战' : 'UNFINISHED CHALLENGE'}</span><h2>{level.name[lang]}</h2><p>{lang === 'zh' ? '建筑与教学进度已经保存。测试和倒计时会从建造阶段重新开始。' : 'Your building and tutorial progress are saved. Tests resume from the building phase.'}</p><button className="primary-button" onClick={onContinue}>{lang === 'zh' ? '继续' : 'Continue'}</button><button onClick={onRestart}>{lang === 'zh' ? '重新开始' : 'Restart'}</button><button onClick={onChapters}>{lang === 'zh' ? '返回章节' : 'Chapters'}</button></section></div>;

export default CampaignResumeModal;
