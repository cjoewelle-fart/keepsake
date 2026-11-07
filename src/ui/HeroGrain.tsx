// The start hero's paper grain (round 2). One static GrainGradient from Paper Shaders (Apache-2.0),
// drawn once (speed 0: no animation loop) behind the hero row only. It loads in its own chunk after
// the page is up, and is skipped under reduced motion or without WebGL 2. Underneath it, always, a
// small bundled grain PNG at 4% (app.css .hero-grain), which is all that shows when it's skipped.
import { Component, Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

const HeroShader = lazy(() => import('./HeroShader'));

/** WebGL 2 is there (what the shader needs) and motion isn't reduced. The test context is released at once. */
function canShade(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/** If the shader's chunk can't load (or the shader throws), the PNG grain alone is fine: show nothing. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export function HeroGrain() {
  const [shade] = useState(canShade);
  // Mounted once the browser is idle, so compiling the shader never delays the words and the button.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!shade) return;
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const t = setTimeout(() => setReady(true), 300);
    return () => clearTimeout(t);
  }, [shade]);
  return (
    <span className="hero-grain" aria-hidden="true">
      {shade && ready && <Quiet><Suspense fallback={null}><HeroShader /></Suspense></Quiet>}
    </span>
  );
}
