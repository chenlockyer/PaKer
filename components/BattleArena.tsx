/**
 * Ground markings for the battle arena: two build zones, the neutral buffer and
 * the core areas. Pure decoration — the rules live in battle/arena.ts.
 */

import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { BattleArena, BattleArenaRect, BattleSide } from '../battle/types';

const SIDE_COLOR: Record<BattleSide, string> = {
  A: '#38bdf8',
  B: '#fb7185',
};

const CORE_COLOR = '#facc15';

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
    dashSize={0.22}
    gapSize={0.16}
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
              opacity={emphasized ? 0.24 : faint ? 0.08 : 0.14}
            />
            <RectOutline
              rect={arena.zones[side]}
              color={SIDE_COLOR[side]}
              opacity={emphasized ? 1 : 0.55}
            />
            <ZoneFill
              rect={arena.coreAreas[side]}
              color={CORE_COLOR}
              opacity={emphasized ? 0.22 : 0.1}
            />
            <RectOutline
              rect={arena.coreAreas[side]}
              color={CORE_COLOR}
              y={0.014}
              opacity={emphasized ? 1 : 0.45}
              dashed
            />
          </group>
        );
      })}
      <ZoneFill rect={arena.buffer} color="#0f172a" opacity={0.22} />
      <RectOutline rect={arena.buffer} color="#94a3b8" y={0.01} opacity={0.3} dashed />
    </group>
  );
};

export default BattleArenaView;
export { SIDE_COLOR };
