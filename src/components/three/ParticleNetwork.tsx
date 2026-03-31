"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 80;
const CONNECTION_DISTANCE = 2.5;
const MOUSE_INFLUENCE = 3;

function Particles() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouseRef = useRef(new THREE.Vector2(0, 0));
  const { viewport } = useThree();

  const particles = useMemo(() => {
    const positions: THREE.Vector3[] = [];
    const velocities: THREE.Vector3[] = [];

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      positions.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * viewport.width * 1.5,
          (Math.random() - 0.5) * viewport.height * 1.5,
          (Math.random() - 0.5) * 2,
        ),
      );
      velocities.push(
        new THREE.Vector3(
          (Math.random() - 0.5) * 0.005,
          (Math.random() - 0.5) * 0.005,
          0,
        ),
      );
    }
    return { positions, velocities };
  }, [viewport.width, viewport.height]);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const lineGeometry = useMemo(
    () => new THREE.BufferGeometry(),
    [],
  );

  useFrame(({ pointer }) => {
    if (!meshRef.current || !linesRef.current) return;

    mouseRef.current.set(
      pointer.x * viewport.width * 0.5,
      pointer.y * viewport.height * 0.5,
    );

    const linePositions: number[] = [];
    const lineColors: number[] = [];

    // Update particles
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const pos = particles.positions[i];
      const vel = particles.velocities[i];

      // Mouse repulsion
      const dx = pos.x - mouseRef.current.x;
      const dy = pos.y - mouseRef.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < MOUSE_INFLUENCE && dist > 0) {
        const force = (1 - dist / MOUSE_INFLUENCE) * 0.01;
        vel.x += (dx / dist) * force;
        vel.y += (dy / dist) * force;
      }

      // Damping
      vel.multiplyScalar(0.99);

      pos.add(vel);

      // Wrap around edges
      const hw = viewport.width * 0.8;
      const hh = viewport.height * 0.8;
      if (pos.x > hw) pos.x = -hw;
      if (pos.x < -hw) pos.x = hw;
      if (pos.y > hh) pos.y = -hh;
      if (pos.y < -hh) pos.y = hh;

      dummy.position.copy(pos);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Draw connections
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dist = particles.positions[i].distanceTo(particles.positions[j]);
        if (dist < CONNECTION_DISTANCE) {
          const opacity = 1 - dist / CONNECTION_DISTANCE;

          linePositions.push(
            particles.positions[i].x,
            particles.positions[i].y,
            particles.positions[i].z,
            particles.positions[j].x,
            particles.positions[j].y,
            particles.positions[j].z,
          );

          lineColors.push(
            0.42, 0.39, 1, opacity * 0.3,
            0.42, 0.39, 1, opacity * 0.3,
          );
        }
      }
    }

    lineGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(linePositions, 3),
    );
    lineGeometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(lineColors, 4),
    );
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, PARTICLE_COUNT]}>
        <circleGeometry args={[0.03, 8]} />
        <meshBasicMaterial color="#6c63ff" transparent opacity={0.6} />
      </instancedMesh>
      <lineSegments ref={linesRef} geometry={lineGeometry}>
        <lineBasicMaterial
          vertexColors
          transparent
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
    </>
  );
}

export function ParticleNetwork() {
  return (
    <div className="absolute inset-0 -z-10">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 75 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true }}
        style={{ background: "transparent" }}
      >
        <Particles />
      </Canvas>
    </div>
  );
}
