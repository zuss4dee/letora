import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

import { LETORA } from "../letora-theme";

/** Pain → promise (copywriting: one idea per beat) */
export function PainScene() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const line2 = interpolate(frame, [25, 55], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill
      style={{
        background: LETORA.bg,
        justifyContent: "center",
        alignItems: "center",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 980, padding: 72, textAlign: "center" }}>
        <p
          style={{
            fontSize: 34,
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: LETORA.heading,
            lineHeight: 1.25,
            margin: 0,
            opacity: enter,
          }}
        >
          Spreadsheets don&apos;t remind you when a gas cert expires.
        </p>
        <p
          style={{
            marginTop: 32,
            fontSize: 26,
            fontWeight: 400,
            color: LETORA.body,
            lineHeight: 1.5,
            opacity: line2,
          }}
        >
          Letora tracks certificates, tenancies, and rent — so you see what needs attention before it becomes a problem.
        </p>
      </div>
    </AbsoluteFill>
  );
}
