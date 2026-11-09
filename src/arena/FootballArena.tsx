import {useLayoutEffect, useRef} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';
import {renderScene} from './draw.ts';
import {getStateAtFrame} from './frameCache.ts';
import {Scoreboard, StatsBar} from './Hud.tsx';
import {ARENA_HEIGHT, LOGICAL_WIDTH, styles} from './layout.ts';

export type FootballArenaProps = {
  /** Aynı seed her render'da aynı maçı üretir. Farklı maç için değiştirin. */
  seed: number;
};

export const FootballArena = ({seed}: FootballArenaProps) => {
  const frame = useCurrentFrame();
  const {fps, width} = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = width / LOGICAL_WIDTH;

  const state = getStateAtFrame({width: LOGICAL_WIDTH, height: ARENA_HEIGHT, seed}, frame, fps);
  const time = frame / fps;

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D bağlamı alınamadı');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    renderScene(ctx, state, time);
  }, [state, time, scale, frame]);

  const [home] = state.balls;
  return (
    <AbsoluteFill style={styles.root}>
      <div style={{...styles.stage, transform: `scale(${scale})`}}>
        <Scoreboard scoreA={state.scoreA} scoreB={state.scoreB} elapsed={state.elapsed} />
        <canvas
          ref={canvasRef}
          width={Math.round(LOGICAL_WIDTH * scale)}
          height={Math.round(ARENA_HEIGHT * scale)}
          style={{width: LOGICAL_WIDTH, height: ARENA_HEIGHT, display: 'block'}}
        />
        <StatsBar speed={Math.hypot(home.vx, home.vy)} goals={state.goalCount} />
      </div>
    </AbsoluteFill>
  );
};
