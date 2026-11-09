import { Composition } from "remotion";
import { FutbolArenaIntro } from "./FutbolArenaIntro";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FutbolArenaIntro"
      component={FutbolArenaIntro}
      durationInFrames={150}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};
