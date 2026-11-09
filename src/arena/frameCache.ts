// Remotion kareleri sırasız ve birden çok sekmede render edebilir.
// Her sekme kendi simülasyonunu tutar: istenen kare ilerideyse oradan devam eder,
// gerideyse baştan simüle eder. Sonuç her durumda seed'e göre aynıdır.
import {advanceTo, createSimulation, stepForFrame, type SimulationOptions, type SimulationState} from './simulation.ts';

const cache = new Map<string, SimulationState>();

export function getStateAtFrame(options: SimulationOptions, frame: number, fps: number): SimulationState {
  const key = `${options.seed}:${options.width}x${options.height}`;
  const target = stepForFrame(frame, fps);
  let state = cache.get(key);
  if (!state || state.stepCount > target) {
    state = createSimulation(options);
    cache.set(key, state);
  }
  advanceTo(state, target);
  return state;
}
