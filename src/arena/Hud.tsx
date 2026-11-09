import {styles} from './layout.ts';

const formatClock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

interface TeamProps {name: string; label: string; crest: string; crestBg: string; score: number; right?: boolean}

const TeamCard = ({name, label, crest, crestBg, score, right = false}: TeamProps) => {
  const crestEl = <div style={{...styles.crest, background: crestBg}}>{crest}</div>;
  const scoreEl = <div style={styles.score}>{score}</div>;
  const info = (
    <div style={{flex: 1, minWidth: 0, textAlign: right ? 'right' : 'left'}}>
      <div style={styles.teamName}>{name}</div>
      <div style={styles.teamLabel}>{label}</div>
    </div>
  );
  return (
    <div style={{...styles.team, justifyContent: right ? 'flex-end' : 'flex-start'}}>
      {right ? <>{scoreEl}{info}{crestEl}</> : <>{crestEl}{info}{scoreEl}</>}
    </div>
  );
};

export const Scoreboard = ({scoreA, scoreB, elapsed}: {scoreA: number; scoreB: number; elapsed: number}) => (
  <header style={styles.header}>
    <TeamCard name="GALATASARAY" label="İSTANBUL" crest="G"
      crestBg="linear-gradient(135deg,#ffd33c 0 48%,#dc1739 49%)" score={scoreA} />
    <div style={styles.middle}>
      <div style={styles.versus}>ARENA PRO</div>
      <div style={styles.clock}>{formatClock(elapsed)}</div>
      <div style={styles.status}>● CANLI</div>
    </div>
    <TeamCard name="BARCELONA" label="BARÇA" crest="B" right
      crestBg="linear-gradient(135deg,#1744a6 0 48%,#bc1741 49%)" score={scoreB} />
  </header>
);

export const StatsBar = ({speed, goals}: {speed: number; goals: number}) => (
  <footer style={styles.footer}>
    <div>TOP HIZI<strong style={styles.statValue}>{Math.round(speed)} px/s</strong></div>
    <div>GOL<strong style={styles.statValue}>{goals}</strong></div>
    <div>FİZİK<strong style={styles.statValue}>STABİL</strong></div>
  </footer>
);
