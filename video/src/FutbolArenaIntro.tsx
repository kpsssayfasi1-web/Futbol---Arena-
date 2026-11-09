import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const BACKGROUND = "radial-gradient(ellipse at center, #172548, #080d1d 65%, #040711)";
const ACCENT = "#5ff0b7";

export const FutbolArenaIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();

  const titleScale = spring({ frame, fps, config: { damping: 12 } });
  const ballY = interpolate(frame, [0, 45], [-200, height * 0.55], {
    extrapolateRight: "clamp",
  });
  const ballSpin = interpolate(frame, [0, 150], [0, 720]);
  const subtitleOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        background: BACKGROUND,
        color: "#f4f7ff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        alignItems: "center",
      }}
    >
      <div
        style={{
          marginTop: height * 0.28,
          fontSize: 120,
          fontWeight: 900,
          textAlign: "center",
          transform: `scale(${titleScale})`,
        }}
      >
        Football Arena
      </div>
      <div style={{ fontSize: 48, fontWeight: 800, color: ACCENT, opacity: subtitleOpacity }}>
        PRO
      </div>
      <div
        style={{
          position: "absolute",
          top: ballY,
          fontSize: 200,
          transform: `rotate(${ballSpin}deg)`,
        }}
      >
        ⚽
      </div>
    </AbsoluteFill>
  );
};
