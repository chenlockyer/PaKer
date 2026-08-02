import React from 'react';
import { ChallengePhase, ChallengeTestType } from '../types';
import { translations } from '../utils/translations';

interface ChallengeHUDProps {
  lang: 'en' | 'zh';
  phase: ChallengePhase;
  cardCount: number;
  maxCards: number;
  minCards: number;
  levelIndex: number;
  levelCount: number;
  levelName: string;
  levelDescription: string;
  testType: ChallengeTestType;
  blueprintRequired: boolean;
  blueprintComplete: boolean;
  liveHeight: number;
  targetHeight: number;
  countdown: number;
  testTimeRemaining: number;
  score: number;
  stars: number;
  onStartTest: () => void;
  onRetry: () => void;
  onUndo: () => void;
  onNext: () => void;
  hasNext: boolean;
}

const ChallengeHUD: React.FC<ChallengeHUDProps> = ({
  lang, phase, cardCount, maxCards, minCards, levelIndex, levelCount,
  levelName, levelDescription, testType, liveHeight, targetHeight,
  blueprintRequired, blueprintComplete,
  countdown, testTimeRemaining, score, stars, onStartTest, onRetry,
  onUndo, onNext, hasNext,
}) => {
  const t = translations[lang];
  const heightProgress = Math.min(100, targetHeight > 0 ? (liveHeight / targetHeight) * 100 : 0);
  const canStart =
    cardCount >= minCards &&
    liveHeight >= targetHeight &&
    (!blueprintRequired || blueprintComplete);
  const testLabel = testType === ChallengeTestType.WEIGHT_DROP
    ? t.weightDropTest
    : testType === ChallengeTestType.WIND ? t.windTestRunning : t.stabilityTest;
  const copy = lang === 'zh'
    ? { objective: '本关目标', progress: '结构进度', cards: '用牌', height: '高度', test: '开始测试', unavailable: '尚未达到测试条件', retry: '重新搭建', next: '下一关', result: '测试结果', complete: '结构通过', failed: '结构倒塌', score: '得分' }
    : { objective: 'OBJECTIVE', progress: 'STRUCTURE', cards: 'Cards', height: 'Height', test: 'Start test', unavailable: 'Requirements not met', retry: 'Rebuild', next: 'Next level', result: 'TEST RESULT', complete: 'Structure passed', failed: 'Structure failed', score: 'Score' };

  return (
    <>
      <aside className="challenge-panel">
        <div className="panel-heading">
          <div>
            <span className="panel-kicker">{copy.objective} · {levelIndex + 1}/{levelCount}</span>
            <strong>{levelName}</strong>
          </div>
          <span className="level-code">{String(levelIndex + 1).padStart(2, '0')}</span>
        </div>
        <p className="challenge-description">{levelDescription}</p>
        <div className="metric-row">
          <span>{copy.cards}</span>
          <strong className={cardCount >= maxCards ? 'metric-alert' : ''}>{cardCount} / {maxCards}</strong>
        </div>
        <div className="metric-row">
          <span>{copy.height}</span>
          <strong className={liveHeight >= targetHeight ? 'metric-good' : ''}>{liveHeight.toFixed(1)} / {targetHeight.toFixed(1)}</strong>
        </div>
        <div className="progress-track"><i style={{ width: `${heightProgress}%` }} /></div>
        {phase === ChallengePhase.BUILDING && (
          <div className="challenge-actions">
            <button data-tutorial-target="control:undo" onClick={onUndo} disabled={cardCount === 0}>{t.undoLast}</button>
            <button data-tutorial-target="control:test" className="primary-button" onClick={onStartTest} disabled={!canStart}>
              {canStart ? copy.test : copy.unavailable}
            </button>
          </div>
        )}
        {phase === ChallengePhase.TESTING && (
          <div className="test-status">
            <span><i />{testLabel}</span>
            <strong>{testTimeRemaining.toFixed(1)} s</strong>
          </div>
        )}
      </aside>

      {phase === ChallengePhase.COUNTDOWN && (
        <div className="countdown-layer">
          <div><span>{testLabel}</span><strong>{countdown}</strong></div>
        </div>
      )}

      {(phase === ChallengePhase.SUCCESS || phase === ChallengePhase.FAILED) && (
        <div className="result-layer">
          <section className={`result-card ${phase === ChallengePhase.SUCCESS ? 'is-success' : 'is-failed'}`}>
            <span className="panel-kicker">{copy.result}</span>
            <div className="result-mark">{phase === ChallengePhase.SUCCESS ? '✓' : '×'}</div>
            <h2>{phase === ChallengePhase.SUCCESS ? copy.complete : copy.failed}</h2>
            <p>{phase === ChallengePhase.SUCCESS ? t.challengeSuccessHint : t.challengeFailedHint}</p>
            {phase === ChallengePhase.SUCCESS && (
              <div className="score-block">
                <div className="rating-pips">
                  {[1, 2, 3].map(value => <i key={value} className={value <= stars ? 'is-filled' : ''} />)}
                </div>
                <strong>{score}</strong><span>{copy.score}</span>
              </div>
            )}
            <div className="result-actions">
              <button onClick={onRetry}>{copy.retry}</button>
              {phase === ChallengePhase.SUCCESS && hasNext && <button className="primary-button" onClick={onNext}>{copy.next}</button>}
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default ChallengeHUD;
