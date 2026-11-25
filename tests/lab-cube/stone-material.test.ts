import { ShaderLib } from "three";
import { describe, expect, it } from "vitest";
import { createStoneMaterial } from "@/app/lab/cube/stone-material";

const field = { data: new Uint8Array(16 * 16), size: 16 };

function compiled() {
  const stone = createStoneMaterial({ ground: "#141619", field, shift: [0.005, 0.003] });
  const shader = {
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader,
    uniforms: {} as Record<string, { value: unknown }>,
  };
  // three's signature takes the renderer too; the material ignores it.
  stone.material.onBeforeCompile(shader as never, undefined as never);
  return { stone, shader };
}

describe("the stone material", () => {
  it("is matte basalt: the ground token, roughness 0.9, metalness 0, no tone mapping", () => {
    const { material } = createStoneMaterial({ ground: "#141619", field, shift: [0, 0] });
    expect(material.roughness).toBe(0.9);
    expect(material.metalness).toBe(0);
    expect(material.toneMapped).toBe(false);
    expect(`#${material.color.getHexString()}`).toBe("#141619");
  });

  it("finds every chunk it extends, so a three upgrade cannot drop the carving silently", () => {
    const { shader } = compiled();
    expect(shader.vertexShader).toContain("vHome = instanceHome;");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb *= 1.0 + uGrain");
    expect(shader.fragmentShader).toContain("outgoingLight *= mix( uOcclusion, 1.0, stoneOuter );");
    // Each injection keeps the chunk it follows.
    expect(shader.vertexShader).toContain("#include <begin_vertex>");
    expect(shader.fragmentShader).toContain("#include <color_fragment>");
    expect(shader.fragmentShader).toContain("#include <opaque_fragment>");
  });

  it("shares its uniforms with the shader, so frames can drive them", () => {
    const { stone, shader } = compiled();
    for (const name of ["uMarkField", "uNoise", "uBevelShift", "uMark", "uScale", "uOcclusion", "uGrain", "uLanded", "uHighlightAdd", "uShadowKeep"]) {
      expect(shader.uniforms[name], name).toBe(stone.uniforms[name as keyof typeof stone.uniforms]);
    }
  });

  it("samples the mark outside any branch: derivatives are undefined in non-uniform control flow", () => {
    const { shader } = compiled();
    const body = shader.fragmentShader.slice(shader.fragmentShader.indexOf("void main"));
    const sample = body.indexOf("carved( markUv )");
    expect(sample).toBeGreaterThan(-1);
    const before = body.slice(0, sample);
    const open = (before.match(/\{/g) ?? []).length;
    const close = (before.match(/\}/g) ?? []).length;
    expect(open - close).toBe(1); // only main's own brace is open
  });
});
