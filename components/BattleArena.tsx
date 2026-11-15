/**
 * Ground markings for the battle arena: the two 15 × 15 cell build zones and
 * the neutral no-build band between them. Pure decoration — the rules live in
 * battle/arena.ts.
 */

import React, { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import type { BattleArena, BattleArenaRect, BattleSide } from '../battle/types';

const SIDE_COLOR: Record<BattleSide, string> = {
  A: '#38bdf8',
  B: '#fb7185',
};

const rectCorners = (rect: BattleArenaRect, y: number): [number, number, number][] => [
  [rect.minX, y, rect.minZ],
  [rect.maxX, y, rect.minZ],
  [rect.maxX, y, rect.maxZ],
  [rect.minX, y, rect.maxZ],
  [rect.minX, y, rect.minZ],
];

const ZoneFill = ({
  rect,
  color,
  opacity,
}: {
  rect: BattleArenaRect;
  color: string;
  opacity: number;
}) => {
  const width = rect.maxX - rect.minX;
  const depth = rect.maxZ - rect.minZ;
  const centerX = (rect.minX + rect.maxX) / 2;
  const centerZ = (rect.minZ + rect.maxZ) / 2;
  return (
    <mesh position={[centerX, 0.006, centerZ]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
};

const RectOutline = ({
  rect,
  color,
  y = 0.012,
  opacity = 0.9,
  dashed = false,
}: {
  rect: BattleArenaRect;
  color: string;
  y?: number;
  opacity?: number;
  dashed?: boolean;
}) => (
  <Line
    points={rectCorners(rect, y)}
    color={color}
    lineWidth={2}
    transparent
    opacity={opacity}
    dashed={dashed}
    dashSize={0.4}
    gapSize={0.3}
    depthWrite={false}
  />
);

export interface BattleArenaViewProps {
  arena: BattleArena;
  activeSide: BattleSide;
  /** Side currently allowed to place cards, if any. */
  placingSide: BattleSide | null;
}

const BattleArenaView: React.FC<BattleArenaViewProps> = ({ arena, activeSide, placingSide }) => {
  const sides = useMemo<BattleSide[]>(() => ['A', 'B'], []);

  // One line-segments geometry for every cell boundary, so the 15 × 15 squares
  // read as cells without spawning ~60 child components.
  const grid = useMemo(() => {
    const positions: number[] = [];
    const push = (a: [number, number, number], b: [number, number, number]) => {
      positions.push(...a, ...b);
    };
    (['A', 'B'] as BattleSide[]).forEach(side => {
      const rect = arena.zones[side];
      for (let offset = rect.minX + arena.cell; offset < rect.maxX - 1e-6; offset += arena.cell) {
        push([offset, 0.008, rect.minZ], [offset, 0.008, rect.maxZ]);
      }
      for (let offset = rect.minZ + arena.cell; offset < rect.maxZ - 1e-6; offset += arena.cell) {
        push([rect.minX, 0.008, offset], [rect.maxX, 0.008, offset]);
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [arena]);

  useEffect(() => () => grid.dispose(), [grid]);

  return (
    <group name="battle-arena">
      {sides.map(side => {
        const emphasized = placingSide === side;
        const faint = activeSide !== side;
        return (
          <group key={side}>
            <ZoneFill
              rect={arena.zones[side]}
              color={SIDE_COLOR[side]}
              opacity={emphasized ? 0.2 : faint ? 0.06 : 0.11}
            />
            <RectOutline
              rect={arena.zones[side]}
              color={SIDE_COLOR[side]}
              opacity={emphasized ? 1 : 0.5}
            />
          </group>
        );
      })}
      <lineSegments geometry={grid}>
        <lineBasicMaterial color="#94a3b8" transparent opacity={0.16} depthWrite={false} />
      </lineSegments>
      <ZoneFill rect={arena.buffer} color="#0f172a" opacity={0.24} />
      <RectOutline rect={arena.buffer} color="#94a3b8" y={0.01} opacity={0.35} dashed />
    </group>
  );
};

export default BattleArenaView;
export { SIDE_COLOR };
