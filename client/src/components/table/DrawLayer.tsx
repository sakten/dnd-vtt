import { useEffect, useRef, useState } from 'react';
import { Layer, Line, Rect } from 'react-konva';
import type Konva from 'konva';
import type { MapInfo } from 'shared';
import { useGameStore } from '../../store/useGameStore';
import { MAX_STROKE_POINTS } from '../../store/slices/draw';

interface Props {
  map: MapInfo;
  /** Режим рисования: слой поверх стола перехватывает ввод. */
  active: boolean;
  color: string;
}

type Point = { x: number; y: number };

const flat = (points: Point[]) => points.flatMap((p) => [p.x, p.y]);

/** Эфемерные штрихи рисования в мировых координатах; в режиме рисования перехватывает клики. */
export default function DrawLayer({ map, active, color }: Props) {
  const strokes = useGameStore((s) => s.strokes);
  const interaction = useGameStore((s) => s.interaction !== null);
  const commitStroke = useGameStore((s) => s.commitStroke);
  const pruneStrokes = useGameStore((s) => s.pruneStrokes);
  const [draft, setDraft] = useState<Point[] | null>(null);
  const draftRef = useRef<Point[] | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const timer = window.setInterval(() => pruneStrokes(), 500);
    return () => window.clearInterval(timer);
  }, [pruneStrokes]);

  // Началось прицеливание/выбор цели — черновик не продолжаем и ввод не держим.
  useEffect(() => {
    if (interaction) {
      drawingRef.current = false;
      draftRef.current = null;
      setDraft(null);
    }
  }, [interaction]);

  const pointOf = (e: Konva.KonvaEventObject<MouseEvent>): Point | null => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return null;
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleX(),
    };
  };

  const finish = () => {
    drawingRef.current = false;
    const points = draftRef.current;
    draftRef.current = null;
    setDraft(null);
    if (points && points.length >= 2) commitStroke(points);
  };

  const down = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (e.evt.button !== 0) return;
    e.evt.preventDefault();
    const point = pointOf(e);
    if (!point) return;
    drawingRef.current = true;
    draftRef.current = [point];
    setDraft([point]);
  };

  const move = (e: Konva.KonvaEventObject<MouseEvent>) => {
    if (!drawingRef.current) return;
    const points = draftRef.current;
    const point = pointOf(e);
    if (!points || !point) return;
    const last = points[points.length - 1]!;
    if (Math.hypot(point.x - last.x, point.y - last.y) < 2 || points.length >= MAX_STROKE_POINTS) return;
    const next = [...points, point];
    draftRef.current = next;
    setDraft(next);
  };

  const visible = strokes.filter((s) => s.mapId === map.id);

  return (
    <Layer listening={active && !interaction}>
      <Rect
        x={0}
        y={0}
        width={map.width}
        height={map.height}
        fill="rgba(0,0,0,0)"
        onMouseDown={down}
        onMouseMove={move}
        onMouseUp={finish}
        onMouseLeave={() => {
          if (drawingRef.current) finish();
        }}
      />
      {visible.map((s) => (
        <Line
          key={s.id}
          points={flat(s.points)}
          stroke={s.color}
          strokeWidth={4}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      ))}
      {draft && draft.length > 1 && (
        <Line
          points={flat(draft)}
          stroke={color}
          strokeWidth={4}
          strokeScaleEnabled={false}
          lineCap="round"
          lineJoin="round"
          listening={false}
        />
      )}
    </Layer>
  );
}
