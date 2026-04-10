import type { FC } from "react";
import { Composition } from "remotion";

import { FPS, TOTAL_FRAMES } from "./letora-theme";
import { LaunchVideo } from "./LaunchVideo";

export const RemotionRoot: FC = () => (
  <>
    <Composition
      id="LaunchVideo"
      component={LaunchVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  </>
);
