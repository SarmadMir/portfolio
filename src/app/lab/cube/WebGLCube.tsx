"use client";

import { PerspectiveCamera, View } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type Ref } from "react";
import {
  InstancedBufferAttribute,
  Matrix4,
  type AmbientLight,
  type DirectionalLight,
  type Group,
  type InstancedMesh,
  type PerspectiveCamera as ThreePerspectiveCamera,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { ThemeId } from "@/lib/theme/theme";
import { useSharedCanvas } from "@/lib/three/CanvasHost";
import {
  BEVEL_LIGHT,
  BEVEL_WIDTH,
  CUBIE_RADIUS,
  CUBIE_SIZE,
  FOV_DEG,
  KEY_LIGHT,
  cubieScale,
  frame,
  lightLevels,
  poseAt,
} from "./framing";
import { bevelOffset } from "./mark";
import { createCube } from "./model";
import type { Rig } from "./rig";
import type { FrameStats } from "./stats";
import { createStoneMaterial } from "./stone-material";
import { cubieMatrix } from "./transforms";

export interface CubeRendererProps {
  /** The current run. Read on every frame, never rendered from, never written. */
  rig: { readonly current: Rig | null };
  /** The run calls the listener whenever the rig has changed what is drawn. */
  subscribe: (listener: () => void) => () => void;
  ground: string;
  theme: ThemeId;
  stats: FrameStats;
}

interface WebGLCubeProps extends CubeRendererProps {
  field: { data: Uint8Array; size: number };
  /** The rig is moving: draw every frame until it stops. */
  animating: boolean;
}

const KEY_DISTANCE = 10;
/** Lights in three are physical: π is "shows the surface as its own colour". */
const UNIT_LIGHT = Math.PI;
const placement = new Matrix4();

/** The 27 instance matrices for this frame. */
function placeCubies(mesh: InstancedMesh, run: Rig, scale: number) {
  run.cubies.forEach((cubie, index) => {
    placement.fromArray(cubieMatrix(cubie, run.turn, scale));
    mesh.setMatrixAt(index, placement);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

const isBusy = (rig: Rig) => rig.turn !== null || rig.sequence.phase === "hold" || rig.sequence.phase === "dolly";

/** The boot cube on the shared canvas: one instanced mesh, one material, one draw call. */
export default function WebGLCube(props: WebGLCubeProps) {
  const ref = useRef<HTMLElement>(null);
  // While the rig moves the canvas draws every frame; otherwise only when the run asks.
  // (Asking per tick is not enough: R3F's demand loop stops after each frame and the
  // next request lands a frame late, which halves the rate.)
  useSharedCanvas(ref, props.animating ? "always" : "demand");
  return (
    <View ref={ref as Ref<HTMLElement>} className="pointer-events-none fixed inset-0" data-cube-renderer="webgl">
      <CubeScene rig={props.rig} subscribe={props.subscribe} ground={props.ground} theme={props.theme} stats={props.stats} field={props.field} />
    </View>
  );
}

function CubeScene({ rig, subscribe, ground, theme, stats, field }: Omit<WebGLCubeProps, "animating">) {
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const size = useThree((state) => state.size);
  const mesh = useRef<InstancedMesh>(null);
  const group = useRef<Group>(null);
  const camera = useRef<ThreePerspectiveCamera>(null);
  const ambient = useRef<AmbientLight>(null);
  const key = useRef<DirectionalLight>(null);

  const geometry = useMemo(() => {
    const box = new RoundedBoxGeometry(1, 1, 1, 3, CUBIE_RADIUS / CUBIE_SIZE);
    const homes = new Float32Array(27 * 3);
    createCube().forEach((cubie, index) => homes.set(cubie.home, index * 3));
    box.setAttribute("instanceHome", new InstancedBufferAttribute(homes, 3));
    return box;
  }, []);

  const stone = useMemo(
    () => createStoneMaterial({ ground, field, shift: bevelOffset(KEY_LIGHT, BEVEL_WIDTH) }),
    // Built once per field; the ground is applied by the effect below whenever it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [field],
  );

  useEffect(() => () => stone.dispose(), [stone]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => subscribe(invalidate), [subscribe, invalidate]);
  useEffect(() => {
    stone.material.color.set(ground);
    invalidate();
  }, [stone, ground, invalidate]);

  // Everything per frame reads the rig. Priority 0 runs before the view renders (priority 1).
  useFrame(() => {
    const run = rig.current;
    const cube = mesh.current;
    if (!run || !cube || !group.current || !camera.current || !ambient.current || !key.current) return;

    const framing = frame(size);
    const pose = poseAt(run.dolly, framing);
    camera.current.position.set(0, 0, pose.distance);
    camera.current.updateMatrixWorld();
    group.current.rotation.set(pose.pitch, pose.yaw, 0, "XYZ");

    const levels = lightLevels(run.dolly, theme);
    ambient.current.intensity = UNIT_LIGHT * levels.ambient;
    key.current.intensity = UNIT_LIGHT * levels.key;
    const scale = cubieScale(run.dolly);
    stone.update({ ...levels, ...BEVEL_LIGHT[theme], mark: run.markOn, scale });
    placeCubies(cube, run, scale);
  });

  // After the view has rendered: what it cost.
  useFrame(() => {
    const run = rig.current;
    stats.renderer(gl.info.render.calls, gl.info.render.triangles);
    stats.frame(performance.now(), run ? isBusy(run) : false);
  }, 2);

  return (
    <>
      <color attach="background" args={[ground]} />
      <PerspectiveCamera ref={camera} makeDefault fov={FOV_DEG} near={0.1} far={60} position={[0, 0, 12]} />
      <ambientLight ref={ambient} />
      <directionalLight
        ref={key}
        position={[KEY_LIGHT[0] * KEY_DISTANCE, KEY_LIGHT[1] * KEY_DISTANCE, KEY_LIGHT[2] * KEY_DISTANCE]}
      />
      <group ref={group}>
        <instancedMesh ref={mesh} args={[geometry, stone.material, 27]} frustumCulled={false} />
      </group>
    </>
  );
}
