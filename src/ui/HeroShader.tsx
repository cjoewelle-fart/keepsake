// Loaded lazily by HeroGrain. The designer's parameters (round 2 spec §6), static: speed 0, frame 0.
import { GrainGradient } from '@paper-design/shaders-react';

export default function HeroShader() {
  return (
    <GrainGradient
      className="hero-shader"
      colorBack="#ECF1F0"
      colors={['#E4EEEF', '#F3E6D8']}
      softness={0.8}
      intensity={0.15}
      noise={0.25}
      shape="wave"
      speed={0}
      frame={0}
    />
  );
}
