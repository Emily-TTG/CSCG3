import {
	Color3,
	CubeTexture,
	Material,
	MaterialDefines,
	MaterialPluginBase,
	Nullable,
	Scene,
	ShaderLanguage,
	StandardMaterial,
	Texture,
	UniformBuffer
} from "@babylonjs/core";

// NOTE(Emily): Babylon offers this slightly wacky shader injection system.
//              I'm not a huge fan of how it's structured but it makes things
//              easier for just adding the knobs we need for globe rendering.

class BodyMapPlugin extends MaterialPluginBase {
	map: Nullable<CubeTexture> = null;
	bump: Nullable<CubeTexture> = null;
	emissive = false;
	bumpStrength = 0.6;
	bumpEpsilon = 0.004;
	emissiveLevel = 1.0;

	constructor(material: Material) {
		super(material, "BodyMap", 200, {
			GLOBEMAP: false,
			GLOBEBUMP: false,
			GLOBEEMISSIVE: false
		});

		this._enable(true);
	}

	getClassName(): string {
		return "BodyMapPlugin";
	}

	prepareDefines(defines: MaterialDefines): void {
		defines["GLOBEMAP"] = this.map !== null;
		defines["GLOBEBUMP"] = this.bump !== null;
		defines["GLOBEEMISSIVE"] = this.emissive && this.map !== null;
	}

	isReadyForSubMesh(): boolean {
		if (this.map && !this.map.isReady()) return false;
		if (this.bump && !this.bump.isReady()) return false;
		return true;
	}

	getSamplers(samplers: string[]): void {
		samplers.push("globeMap", "globeBumpMap");
	}

	getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
		return {
			ubo: [
				{ name: "globeBumpStrength", size: 1, type: "float" },
				{ name: "globeBumpEpsilon", size: 1, type: "float" },
				{ name: "globeEmissiveLevel", size: 1, type: "float" }
			],
			fragment:
				"uniform float globeBumpStrength;\n" +
				"uniform float globeBumpEpsilon;\n" +
				"uniform float globeEmissiveLevel;\n"
		};
	}

	bindForSubMesh(uniformBuffer: UniformBuffer): void {
		uniformBuffer.updateFloat("globeBumpStrength", this.bumpStrength);
		uniformBuffer.updateFloat("globeBumpEpsilon", this.bumpEpsilon);
		uniformBuffer.updateFloat("globeEmissiveLevel", this.emissiveLevel);
		if (this.map) uniformBuffer.setTexture("globeMap", this.map);
		if (this.bump) uniformBuffer.setTexture("globeBumpMap", this.bump);
	}

	getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Nullable<{ [point: string]: string }> {
		if (shaderLanguage === ShaderLanguage.WGSL) return null;

		if (shaderType === "vertex") {
			return {
				CUSTOM_VERTEX_DEFINITIONS: `
					varying vec3 vGlobeDirection;
					#ifdef GLOBEBUMP
						varying vec3 vGlobeWorldX;
						varying vec3 vGlobeWorldY;
						varying vec3 vGlobeWorldZ;
					#endif
				`,

				CUSTOM_VERTEX_MAIN_END: `
					vGlobeDirection = position;
					#ifdef GLOBEBUMP
						vGlobeWorldX = finalWorld[0].xyz;
						vGlobeWorldY = finalWorld[1].xyz;
						vGlobeWorldZ = finalWorld[2].xyz;
					#endif
				`
			};
		}

		if (shaderType === "fragment") {
			return {
				CUSTOM_FRAGMENT_DEFINITIONS: `
					varying vec3 vGlobeDirection;
					#ifdef GLOBEMAP
						uniform samplerCube globeMap;
					#endif
					#ifdef GLOBEBUMP
						uniform samplerCube globeBumpMap;
						varying vec3 vGlobeWorldX;
						varying vec3 vGlobeWorldY;
						varying vec3 vGlobeWorldZ;
					#endif
				`,

				// baseColor is the slot diffuseTexture would fill, and it
				// multiplies the lit term rather than being added after it.
				CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
					#ifdef GLOBEMAP
						baseColor.rgb = textureCube(globeMap, normalize(vGlobeDirection)).rgb;
					#endif
				`,

				// Bump with no UVs and no tangents: finite-difference the height
				// cube along two directions tangent to the sphere.
				CUSTOM_FRAGMENT_BEFORE_LIGHTS: `
					#ifdef GLOBEBUMP
					{
						vec3 gn = normalize(vGlobeDirection);
						vec3 gAxis = abs(gn.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
						vec3 gt = normalize(cross(gAxis, gn));
						vec3 gb = cross(gn, gt);
						float gh = textureCube(globeBumpMap, gn).r;
						float gdu = textureCube(globeBumpMap, normalize(gn + gt * globeBumpEpsilon)).r - gh;
						float gdv = textureCube(globeBumpMap, normalize(gn + gb * globeBumpEpsilon)).r - gh;
						vec3 gp = normalize(gn - globeBumpStrength * (gdu * gt + gdv * gb) / globeBumpEpsilon);
						mat3 gWorld = mat3(vGlobeWorldX, vGlobeWorldY, vGlobeWorldZ);
						normalW = normalize(gWorld * gp);
					}
					#endif
				`,

				// The star is not lit by anything, including itself.
				CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
					#ifdef GLOBEEMISSIVE
						color.rgb = textureCube(globeMap, normalize(vGlobeDirection)).rgb * globeEmissiveLevel;
					#endif
				`
			};
		}

		return null;
	}
}

export interface BodyMaterialOptions {
	// Cubemap root for albedo.
	surface?: string;
	// Cubemap root for the height map.
	bump?: string;
	bumpStrength?: number;
	bumpEpsilon?: number;
	baseColor?: Color3;
	emissive?: boolean;
	emissiveLevel?: number;
	// Diffuse multiplier.
	brightness?: number;
}

export function bodyMaterial(scene: Scene, name: string, options: BodyMaterialOptions): StandardMaterial {
	const material = new StandardMaterial(name + "-mat", scene);

	const brightness = options.brightness ?? 1;
	material.diffuseColor = (options.baseColor ?? Color3.White()).scale(brightness);
	material.specularColor = new Color3(0.08, 0.08, 0.08);

	const plugin = new BodyMapPlugin(material);

	if (options.surface) {
		plugin.map = new CubeTexture(options.surface, scene);
	}

	if (options.bump) {
		plugin.bump = new CubeTexture(options.bump, scene);
		plugin.bumpStrength = options.bumpStrength ?? 0.2;
		plugin.bumpEpsilon = options.bumpEpsilon ?? 0.004;
	}

	if (options.emissive) {
		plugin.emissive = true;
		plugin.emissiveLevel = options.emissiveLevel ?? 1;
		material.disableLighting = true;
	}

	material.markAsDirty(Material.TextureDirtyFlag);
	return material;
}

// NOTE(Emily): We could make the rings out of true geometry but this is just
//              more convenient.

class RingMapPlugin extends MaterialPluginBase {
	colour: Nullable<Texture> = null;
	alpha: Nullable<Texture> = null;
	inner = 1;
	outer = 2;

	constructor(material: Material) {
		super(material, "RingMap", 200, { RINGMAP: false, RINGALPHA: false });
		this._enable(true);
	}

	getClassName(): string {
		return "RingMapPlugin";
	}

	prepareDefines(defines: MaterialDefines): void {
		defines["RINGMAP"] = this.colour !== null;
		defines["RINGALPHA"] = this.alpha !== null;
	}

	isReadyForSubMesh(): boolean {
		if (this.colour && !this.colour.isReady()) return false;
		if (this.alpha && !this.alpha.isReady()) return false;
		return true;
	}

	getSamplers(samplers: string[]): void {
		samplers.push("ringMap", "ringAlphaMap");
	}

	getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
		return {
			ubo: [
				{ name: "ringInner", size: 1, type: "float" },
				{ name: "ringOuter", size: 1, type: "float" }
			],
			fragment: "uniform float ringInner;\nuniform float ringOuter;\n"
		};
	}

	bindForSubMesh(uniformBuffer: UniformBuffer): void {
		uniformBuffer.updateFloat("ringInner", this.inner);
		uniformBuffer.updateFloat("ringOuter", this.outer);
		if (this.colour) uniformBuffer.setTexture("ringMap", this.colour);
		if (this.alpha) uniformBuffer.setTexture("ringAlphaMap", this.alpha);
	}

	getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Nullable<{ [point: string]: string }> {
		if (shaderLanguage === ShaderLanguage.WGSL) return null;

		if (shaderType === "vertex") {
			return {
				CUSTOM_VERTEX_DEFINITIONS: "varying vec3 vRingPosition;",
				CUSTOM_VERTEX_MAIN_END: "vRingPosition = position;"
			};
		}

		if (shaderType === "fragment") {
			return {
				CUSTOM_FRAGMENT_DEFINITIONS: `
					varying vec3 vRingPosition;
					#ifdef RINGMAP
						uniform sampler2D ringMap;
					#endif
					#ifdef RINGALPHA
						uniform sampler2D ringAlphaMap;
					#endif
				`,

				// A ring texture is a one-dimensional function of radius.
				CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
					#ifdef RINGMAP
						float ringU = clamp(
							(length(vRingPosition.xz) - ringInner) / (ringOuter - ringInner),
							0.0, 1.0);
						baseColor.rgb = texture2D(ringMap, vec2(ringU, 0.5)).rgb;
						#ifdef RINGALPHA
							alpha *= texture2D(ringAlphaMap, vec2(ringU, 0.5)).r;
						#endif
					#endif
				`
			};
		}

		return null;
	}
}

export interface RingMaterialOptions {
	colour: string;
	alpha?: string;
	innerRadius: number;
	outerRadius: number;
}

export function ringMaterial(scene: Scene, name: string, options: RingMaterialOptions): StandardMaterial {
	const material = new StandardMaterial(name + "-mat", scene);
	material.diffuseColor = Color3.White();
	material.specularColor = new Color3(0.02, 0.02, 0.02);

	// annulus() emits both faces with opposed normals.
	material.backFaceCulling = true;
	material.transparencyMode = Material.MATERIAL_ALPHABLEND;

	const plugin = new RingMapPlugin(material);
	plugin.colour = new Texture(options.colour, scene);
	if (options.alpha) plugin.alpha = new Texture(options.alpha, scene);
	plugin.inner = options.innerRadius;
	plugin.outer = options.outerRadius;

	material.markAsDirty(Material.TextureDirtyFlag);
	return material;
}
