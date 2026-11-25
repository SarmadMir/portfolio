import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  MeshStandardMaterial,
  RedFormat,
  RepeatWrapping,
  UnsignedByteType,
  Vector2,
  type WebGLProgramParametersWithUniforms,
} from "three";
import { CUBIE_SIZE } from "./framing";
import { GRAIN_SIZE, grainBytes } from "./grain";

/**
 * The cube's one material: MeshStandardMaterial (matte basalt, roughness 0.9,
 * metalness 0) extended with what a stone cube needs, all per instance:
 *   - occlusion: faces inside the solved cube are darker, so the seams read as dark gaps;
 *   - grain: a small noise texture in the albedo;
 *   - the carving: the mark's distance field, cut into the front face as a bevel
 *     (a lit edge and a shadowed edge, never a fill), split across the nine
 *     front cubies by their position, so it travels with them through the scramble.
 * No tone mapping: with the key off and ambient at π the stone shows exactly
 * the ground token, which is how the face becomes the page.
 */

interface StoneOptions {
  /** The ground token. */
  ground: string;
  /** The mark's distance field, one byte per texel, row 0 at the top. */
  field: { data: Uint8Array; size: number };
  /** Where the lit edge's copy of the mark sits, in face UV (x right, y down). */
  shift: readonly [number, number];
}

const VERTEX_HEADER = /* glsl */ `
attribute vec3 instanceHome;
varying vec3 vHome;
varying vec3 vLocal;
varying vec3 vLocalNormal;
`;

const VERTEX_BODY = /* glsl */ `
vHome = instanceHome;
vLocal = position;
vLocalNormal = normal;
`;

const FRAGMENT_HEADER = /* glsl */ `
uniform sampler2D uMarkField;
uniform sampler2D uNoise;
uniform vec2 uBevelShift;
uniform float uMark;
uniform float uScale;
uniform float uOcclusion;
uniform float uGrain;
uniform float uLanded;
uniform float uHighlightAdd;
uniform float uShadowKeep;
varying vec3 vHome;
varying vec3 vLocal;
varying vec3 vLocalNormal;

float carved( vec2 uv ) {
	float d = texture2D( uMarkField, uv ).r;
	float w = max( fwidth( d ) * 0.7, 1e-3 );
	return smoothstep( 0.5 - w, 0.5 + w, d );
}
`;

// After <color_fragment>: which face this is, the grain, and the carving.
const FRAGMENT_SURFACE = /* glsl */ `
vec3 stoneNormalAbs = abs( vLocalNormal );
float stoneSide;
float stoneHome;
vec2 stoneFaceUv;
float stoneFront = 0.0;
if ( stoneNormalAbs.x >= stoneNormalAbs.y && stoneNormalAbs.x >= stoneNormalAbs.z ) {
	stoneSide = sign( vLocalNormal.x ); stoneHome = vHome.x; stoneFaceUv = vLocal.yz;
} else if ( stoneNormalAbs.y >= stoneNormalAbs.z ) {
	stoneSide = sign( vLocalNormal.y ); stoneHome = vHome.y; stoneFaceUv = vLocal.xz + 0.5;
} else {
	stoneSide = sign( vLocalNormal.z ); stoneHome = vHome.z; stoneFaceUv = vLocal.xy + 0.25;
	stoneFront = step( 0.0, stoneSide );
}
// Outer: this face is on the outside of the cube when it is solved.
float stoneOuter = 1.0 - step( 0.5, abs( stoneHome - stoneSide ) );

float grainValue = texture2D( uNoise, stoneFaceUv * 2.0 + vHome.xy * 0.37 + vHome.z * 0.61 ).r;
diffuseColor.rgb *= 1.0 + uGrain * 0.22 * ( grainValue - 0.5 );

// The front face of a front cubie carries its ninth of the mark, in its own frame.
float markMask = uMark * stoneFront * step( 0.5, vHome.z );
vec2 facePoint = vHome.xy + vLocal.xy * uScale;
vec2 markUv = vec2( facePoint.x + 1.5, 1.5 - facePoint.y ) / 3.0;
float markInside = carved( markUv );
float markCopy = carved( markUv - uBevelShift );
float bevelLit = markMask * markCopy * ( 1.0 - markInside );
float bevelShadow = markMask * markInside * ( 1.0 - markCopy );
`;

// Before <opaque_fragment>: occlusion, then the carving's two walls.
const FRAGMENT_LIGHT = /* glsl */ `
outgoingLight *= mix( uOcclusion, 1.0, stoneOuter );
float stoneCatch = mix( max( dot( normal, directionalLights[ 0 ].direction ), 0.0 ), 1.0, uLanded );
outgoingLight += diffuseColor.rgb * uHighlightAdd * stoneCatch * bevelLit;
outgoingLight *= mix( 1.0, uShadowKeep, bevelShadow );
`;

function inject(source: string, chunk: string, code: string, where: "before" | "after"): string {
  const include = `#include <${chunk}>`;
  if (!source.includes(include)) throw new Error(`stone material: three no longer has ${include}`);
  return source.replace(include, where === "after" ? `${include}\n${code}` : `${code}\n${include}`);
}

function dataTexture(data: Uint8Array, size: number, repeat: boolean): DataTexture {
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType);
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export interface StoneFrame {
  occlusion: number;
  grain: number;
  landed: number;
  highlightAdd: number;
  shadowKeep: number;
  /** Whether the carving shows: off once the page's mark has taken over. */
  mark: boolean;
  /** Cubie edge, as the instance matrices scale it. */
  scale: number;
}

export function createStoneMaterial({ ground, field, shift }: StoneOptions) {
  const markField = dataTexture(field.data, field.size, false);
  const noise = dataTexture(grainBytes(), GRAIN_SIZE, true);

  const uniforms = {
    uMarkField: { value: markField },
    uNoise: { value: noise },
    uBevelShift: { value: new Vector2(shift[0], shift[1]) },
    uMark: { value: 1 },
    uScale: { value: CUBIE_SIZE },
    uOcclusion: { value: 1 },
    uGrain: { value: 1 },
    uLanded: { value: 0 },
    uHighlightAdd: { value: 0 },
    uShadowKeep: { value: 1 },
  };

  const material = new MeshStandardMaterial({ color: ground, roughness: 0.9, metalness: 0 });
  material.toneMapped = false;
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = inject(shader.vertexShader, "common", VERTEX_HEADER, "after");
    shader.vertexShader = inject(shader.vertexShader, "begin_vertex", VERTEX_BODY, "after");
    shader.fragmentShader = inject(shader.fragmentShader, "common", FRAGMENT_HEADER, "after");
    shader.fragmentShader = inject(shader.fragmentShader, "color_fragment", FRAGMENT_SURFACE, "after");
    shader.fragmentShader = inject(shader.fragmentShader, "opaque_fragment", FRAGMENT_LIGHT, "before");
  };
  material.customProgramCacheKey = () => "lab-cube-stone";

  return {
    material,
    uniforms,
    /** Per frame: the light, the seams and whether the carving shows. */
    update(frame: StoneFrame) {
      uniforms.uOcclusion.value = frame.occlusion;
      uniforms.uGrain.value = frame.grain;
      uniforms.uLanded.value = frame.landed;
      uniforms.uHighlightAdd.value = frame.highlightAdd;
      uniforms.uShadowKeep.value = frame.shadowKeep;
      uniforms.uMark.value = frame.mark ? 1 : 0;
      uniforms.uScale.value = frame.scale;
    },
    dispose() {
      material.dispose();
      markField.dispose();
      noise.dispose();
    },
  };
}

export type StoneMaterial = ReturnType<typeof createStoneMaterial>;
