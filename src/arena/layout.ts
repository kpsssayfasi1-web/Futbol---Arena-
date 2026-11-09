import type {CSSProperties} from 'react';

// Tasarım, index.html'deki mobil görünümle aynı ölçülerde (360x640) yapılır
// ve videoya ölçeklenir (1080x1920 için 3x).
export const LOGICAL_WIDTH = 360;
export const LOGICAL_HEIGHT = 640;
export const HEADER_HEIGHT = 64;
export const FOOTER_HEIGHT = 40;
export const ARENA_HEIGHT = LOGICAL_HEIGHT - HEADER_HEIGHT - FOOTER_HEIGHT;

export const FONT = '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif';

export const styles = {
  root: {
    background: 'radial-gradient(ellipse at center,#172548,#080d1d 65%,#040711)',
    color: '#f4f7ff',
    fontFamily: FONT,
  },
  stage: {
    position: 'absolute', left: 0, top: 0,
    width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT,
    transformOrigin: '0 0', display: 'flex', flexDirection: 'column',
  },
  header: {
    height: HEADER_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 5, padding: '9px 9px 6px', boxSizing: 'border-box',
  },
  team: {
    display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1,
    background: '#121d35e8', border: '1px solid #30446b', padding: '7px 6px', borderRadius: 13,
  },
  crest: {
    width: 27, height: 27, display: 'grid', placeItems: 'center', flexShrink: 0,
    borderRadius: '50%', fontSize: 15, fontWeight: 900, color: 'white',
  },
  teamName: {fontSize: 8.5, fontWeight: 900, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'},
  teamLabel: {fontSize: 9, color: '#95a9cf', marginTop: 3},
  score: {fontSize: 22, fontWeight: 950, minWidth: 18, textAlign: 'center'},
  middle: {textAlign: 'center', flexShrink: 0, padding: '0 3px'},
  versus: {fontSize: 9, fontWeight: 900, color: '#91a6d2'},
  clock: {fontSize: 13, fontWeight: 900, marginTop: 4, fontVariantNumeric: 'tabular-nums'},
  status: {fontSize: 9, color: '#5ff0b7', marginTop: 3},
  footer: {
    height: FOOTER_HEIGHT, padding: '0 11px', display: 'flex', alignItems: 'center',
    justifyContent: 'space-between', fontSize: 10, color: '#91a5ca', boxSizing: 'border-box',
  },
  statValue: {color: '#fff', fontSize: 11, marginLeft: 4},
} satisfies Record<string, CSSProperties>;
