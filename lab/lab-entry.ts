import { detectGridFromImageData } from '../client/src/lib/gridDetect';
import { detectWalls } from '../client/src/lib/wallDetect';
import { detectWallsLocal } from './localCells';
import { detectWallsSkeleton } from './skeleton';
import { detectWallsContour } from './contour';
import { annotateWalls } from './annotate';

(window as unknown as { __lab: unknown }).__lab = {
  detectGridFromImageData,
  detectWalls,
  detectWallsLocal,
  detectWallsSkeleton,
  detectWallsContour,
  annotateWalls,
};
