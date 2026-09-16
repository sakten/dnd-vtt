import { describe, expect, it } from 'vitest';
import { startWalkSession, walkDuration, walkFrame, walkedPoints } from './walk';

const POINTS = [
  { x: 0, y: 0 },
  { x: 50, y: 0 },
  { x: 100, y: 0 },
];

describe('walkDuration', () => {
  it('150 мс на шаг с клампом', () => {
    expect(walkDuration(2)).toBe(150);
    expect(walkDuration(6)).toBe(750);
    expect(walkDuration(20)).toBe(1500);
  });
});

describe('walkFrame', () => {
  it('до старта (метка раньше startedAt) — стартовая точка без шагов', () => {
    const session = startWalkSession(POINTS, 1000);
    const frame = walkFrame(session, 980);
    expect(frame.position).toEqual({ x: 0, y: 0 });
    expect(frame.steps).toEqual([]);
    expect(frame.settled).toBe(false);
  });

  it('середина сегмента — интерполяция и один шаг', () => {
    const session = startWalkSession(POINTS, 0);
    const frame = walkFrame(session, 210);
    expect(frame.position).toEqual({ x: 70, y: 0 });
    expect(frame.steps).toEqual([1]);
  });

  it('длинный кадр не пропускает шаги', () => {
    const session = startWalkSession(POINTS, 0);
    const frame = walkFrame(session, 300);
    expect(frame.steps).toEqual([1, 2]);
    expect(frame.position).toEqual({ x: 100, y: 0 });
    expect(frame.settled).toBe(true);
  });

  it('повторный кадр не повторяет шаги', () => {
    const session = startWalkSession(POINTS, 0);
    walkFrame(session, 300);
    const again = walkFrame(session, 400);
    expect(again.steps).toEqual([]);
    expect(again.settled).toBe(true);
  });
});

describe('walkedPoints', () => {
  it('обрезает путь по шагу', () => {
    const session = startWalkSession(POINTS, 0);
    expect(walkedPoints(session, 1)).toEqual([
      { x: 0, y: 0 },
      { x: 50, y: 0 },
    ]);
    expect(walkedPoints(session, 99)).toEqual(POINTS);
  });
});
