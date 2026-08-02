import React from 'react';
import { CampaignDefinition, CampaignProgress } from '../types';
import { isCampaignEntryUnlocked, levelProgressKey } from '../services/campaignService';

interface Props {
  campaign: CampaignDefinition;
  progress: CampaignProgress;
  lang: 'zh' | 'en';
  onSelect: (entryId: string) => void;
  onClose: () => void;
}

const CampaignSelect: React.FC<Props> = ({ campaign, progress, lang, onSelect, onClose }) => <div className="modal-layer campaign-select-layer ui-scale-surface" role="dialog" aria-modal="true">
  <section className="campaign-select-window">
    <header className="blueprint-header"><div><span className="panel-kicker">{lang === 'zh' ? '开始挑战' : 'CHALLENGE'}</span><h2>{campaign.name[lang]}</h2><p>{campaign.description[lang]}</p></div><button className="close-button" onClick={onClose}>×</button></header>
    <div className="campaign-map">
      {campaign.chapters.filter(chapter => chapter.enabled).map((chapter, chapterIndex) => {
        const entries = chapter.levels.filter(entry => entry.enabled);
        const completed = entries.filter(entry => progress.results[levelProgressKey(entry.level)]).length;
        const chapterUnlocked = entries.some(entry => isCampaignEntryUnlocked(campaign, progress, entry.id));
        return <article className={`campaign-map-chapter ${chapterUnlocked ? '' : 'is-locked'}`} key={chapter.id}>
          <header><span>{String(chapterIndex + 1).padStart(2, '0')}</span><div><h3>{chapter.name[lang]}</h3><p>{chapter.description[lang]}</p></div><strong>{completed}/{entries.length}</strong></header>
          <div className="campaign-map-levels">{entries.map((entry, levelIndex) => {
            const unlocked = isCampaignEntryUnlocked(campaign, progress, entry.id);
            const result = progress.results[levelProgressKey(entry.level)];
            return <button key={entry.id} disabled={!unlocked} className={result ? 'is-complete' : ''} onClick={() => onSelect(entry.id)}><span>{chapterIndex + 1}-{levelIndex + 1}</span><strong>{entry.level.name[lang]}</strong><small>{!unlocked ? '◆' : result ? '★'.repeat(result.bestStars) : '○'}</small></button>;
          })}</div>
        </article>;
      })}
    </div>
  </section>
</div>;

export default CampaignSelect;
