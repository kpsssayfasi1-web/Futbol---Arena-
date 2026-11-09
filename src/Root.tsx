import {Composition} from 'remotion';
import {FootballArena} from './arena/FootballArena.tsx';

const FPS = 30;
const DURATION_SECONDS = 20;

export const RemotionRoot = () => (
  <Composition
    id="FootballArena"
    component={FootballArena}
    durationInFrames={FPS * DURATION_SECONDS}
    fps={FPS}
    width={1080}
    height={1920}
    defaultProps={{seed: 2024}}
  />
);
