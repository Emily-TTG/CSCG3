import {
	Color3,
	Constants,
	CubeTexture,
	Material,
	MaterialDefines,
	MaterialPluginBase,
	Nullable,
	Scene,
	ShaderLanguage,
	StandardMaterial,
	Texture,
	UniformBuffer,
	Vector3
} from "@babylonjs/core";

import { SECOND } from "./utility.js";

// NOTE(Emily): Babylon offers this slightly wacky shader injection system.
//              I'm not a huge fan of how it's structured but it makes things
//              easier for just adding the knobs we need for globe rendering.

class BodyMapPlugin extends MaterialPluginBase {
	map: Nullable<CubeTexture> = null;
	bump: Nullable<CubeTexture> = null;
	specularMask: Nullable<CubeTexture> = null;
	cloudMap: Nullable<CubeTexture> = null;
	cloudAlpha: Nullable<CubeTexture> = null;
	cloudOpacity = 1.0;
	cloudGain = 1.0;
	// 1 when the alpha map is dark where the cloud is.
	cloudAlphaInvert = 0.0;
	nightMap: Nullable<CubeTexture> = null;
	nightLevel = 1.0;
	// sin of the sun depression at which the lights are fully up.
	nightBand = 0.105;
	starPosition = new Vector3(0, 0, 0);
	cloudPhase = 0.0;
	emissive = false;
	bumpStrength = 0.6;
	bumpEpsilon = 0.004;
	emissiveLevel = 1.0;
	tint = new Color3(1, 1, 1);
	limbU1 = 0.0;
	limbU2 = 0.0;
	chromoColor = new Color3(0, 0, 0);
	chromoFraction = 0.0;
	chromoStrength = 0.0;
	churnAmount = 0.0;
	churnSpeed = 0.0;
	time = 0.0;

	constructor(material: Material) {
		super(material, "BodyMap", 200, {
			GLOBEMAP: false,
			GLOBEBUMP: false,
			GLOBESPECULAR: false,
			GLOBECLOUDS: false,
			GLOBENIGHT: false,
			GLOBEEMISSIVE: false,
			GLOBECHURN: false
		});

		this._enable(true);
	}

	getClassName(): string {
		return "BodyMapPlugin";
	}

	prepareDefines(defines: MaterialDefines): void {
		defines["GLOBEMAP"] = this.map !== null;
		defines["GLOBEBUMP"] = this.bump !== null;
		defines["GLOBESPECULAR"] = this.specularMask !== null;
		defines["GLOBECLOUDS"] = this.cloudMap !== null && this.cloudAlpha !== null;
		defines["GLOBENIGHT"] = this.nightMap !== null;
		defines["GLOBEEMISSIVE"] = this.emissive && this.map !== null;
		defines["GLOBECHURN"] = this.churnAmount > 0;
	}

	isReadyForSubMesh(): boolean {
		if (this.map && !this.map.isReady()) return false;
		if (this.bump && !this.bump.isReady()) return false;
		if (this.specularMask && !this.specularMask.isReady()) return false;
		if (this.cloudMap && !this.cloudMap.isReady()) return false;
		if (this.cloudAlpha && !this.cloudAlpha.isReady()) return false;
		if (this.nightMap && !this.nightMap.isReady()) return false;
		return true;
	}

	getSamplers(samplers: string[]): void {
		samplers.push("globeMap", "globeBumpMap", "globeSpecularMask",
			"globeCloudMap", "globeCloudAlphaMap", "globeNightMap");
	}

	getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
		return {
			ubo: [
				{ name: "globeTint", size: 3, type: "vec3" },
				{ name: "globeChromoColor", size: 3, type: "vec3" },
				{ name: "globeStarPosition", size: 3, type: "vec3" },
				{ name: "globeBumpStrength", size: 1, type: "float" },
				{ name: "globeBumpEpsilon", size: 1, type: "float" },
				{ name: "globeEmissiveLevel", size: 1, type: "float" },
				{ name: "globeLimbU1", size: 1, type: "float" },
				{ name: "globeLimbU2", size: 1, type: "float" },
				{ name: "globeChromoFraction", size: 1, type: "float" },
				{ name: "globeChromoStrength", size: 1, type: "float" },
				{ name: "globeChurnAmount", size: 1, type: "float" },
				{ name: "globeChurnSpeed", size: 1, type: "float" },
				{ name: "globeCloudOpacity", size: 1, type: "float" },
				{ name: "globeCloudGain", size: 1, type: "float" },
				{ name: "globeCloudAlphaInvert", size: 1, type: "float" },
				{ name: "globeNightLevel", size: 1, type: "float" },
				{ name: "globeNightBand", size: 1, type: "float" },
				{ name: "globeCloudPhase", size: 1, type: "float" },
				{ name: "globeTime", size: 1, type: "float" }
			],
			fragment:
				"uniform vec3 globeTint;\n" +
				"uniform vec3 globeChromoColor;\n" +
				"uniform vec3 globeStarPosition;\n" +
				"uniform float globeBumpStrength;\n" +
				"uniform float globeBumpEpsilon;\n" +
				"uniform float globeEmissiveLevel;\n" +
				"uniform float globeLimbU1;\n" +
				"uniform float globeLimbU2;\n" +
				"uniform float globeChromoFraction;\n" +
				"uniform float globeChromoStrength;\n" +
				"uniform float globeChurnAmount;\n" +
				"uniform float globeChurnSpeed;\n" +
				"uniform float globeCloudOpacity;\n" +
				"uniform float globeCloudGain;\n" +
				"uniform float globeCloudAlphaInvert;\n" +
				"uniform float globeNightLevel;\n" +
				"uniform float globeNightBand;\n" +
				"uniform float globeCloudPhase;\n" +
				"uniform float globeTime;\n"
		};
	}

	bindForSubMesh(uniformBuffer: UniformBuffer): void {
		uniformBuffer.updateColor3("globeTint", this.tint);
		uniformBuffer.updateColor3("globeChromoColor", this.chromoColor);
		uniformBuffer.updateFloat3("globeStarPosition",
			this.starPosition.x, this.starPosition.y, this.starPosition.z);
		uniformBuffer.updateFloat("globeLimbU1", this.limbU1);
		uniformBuffer.updateFloat("globeLimbU2", this.limbU2);
		uniformBuffer.updateFloat("globeChromoFraction", this.chromoFraction);
		uniformBuffer.updateFloat("globeChromoStrength", this.chromoStrength);
		uniformBuffer.updateFloat("globeChurnAmount", this.churnAmount);
		uniformBuffer.updateFloat("globeChurnSpeed", this.churnSpeed);
		uniformBuffer.updateFloat("globeCloudOpacity", this.cloudOpacity);
		uniformBuffer.updateFloat("globeCloudGain", this.cloudGain);
		uniformBuffer.updateFloat("globeCloudAlphaInvert", this.cloudAlphaInvert);
		uniformBuffer.updateFloat("globeNightLevel", this.nightLevel);
		uniformBuffer.updateFloat("globeNightBand", this.nightBand);
		uniformBuffer.updateFloat("globeCloudPhase", this.cloudPhase);
		uniformBuffer.updateFloat("globeTime", this.time);
		uniformBuffer.updateFloat("globeBumpStrength", this.bumpStrength);
		uniformBuffer.updateFloat("globeBumpEpsilon", this.bumpEpsilon);
		uniformBuffer.updateFloat("globeEmissiveLevel", this.emissiveLevel);
		if (this.map) uniformBuffer.setTexture("globeMap", this.map);
		if (this.bump) uniformBuffer.setTexture("globeBumpMap", this.bump);
		if (this.specularMask) uniformBuffer.setTexture("globeSpecularMask", this.specularMask);
		if (this.cloudMap) uniformBuffer.setTexture("globeCloudMap", this.cloudMap);
		if (this.cloudAlpha) uniformBuffer.setTexture("globeCloudAlphaMap", this.cloudAlpha);
		if (this.nightMap) uniformBuffer.setTexture("globeNightMap", this.nightMap);
	}

	getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Nullable<{ [point: string]: string }> {
		if (shaderLanguage === ShaderLanguage.WGSL) return null;

		if (shaderType === "vertex") {
			return {
				CUSTOM_VERTEX_DEFINITIONS: `
					varying vec3 vGlobeDirection;
					#if defined(GLOBEBUMP) || defined(GLOBEEMISSIVE) || defined(GLOBENIGHT)
						varying vec3 vGlobeWorldX;
						varying vec3 vGlobeWorldY;
						varying vec3 vGlobeWorldZ;
					#endif
				`,

				CUSTOM_VERTEX_MAIN_END: `
					vGlobeDirection = position;
					#if defined(GLOBEBUMP) || defined(GLOBEEMISSIVE) || defined(GLOBENIGHT)
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
					#endif
					#ifdef GLOBESPECULAR
						uniform samplerCube globeSpecularMask;
					#endif
					#ifdef GLOBECLOUDS
						uniform samplerCube globeCloudMap;
						uniform samplerCube globeCloudAlphaMap;
					#endif
					#ifdef GLOBENIGHT
						uniform samplerCube globeNightMap;
					#endif
					#if defined(GLOBEBUMP) || defined(GLOBEEMISSIVE) || defined(GLOBENIGHT)
						varying vec3 vGlobeWorldX;
						varying vec3 vGlobeWorldY;
						varying vec3 vGlobeWorldZ;
					#endif
				`,

				CUSTOM_FRAGMENT_MAIN_BEGIN: "float gGlobeCloud = 0.0;",

				// baseColor is the slot diffuseTexture would fill, and it
				// multiplies the lit term rather than being added after it.
				CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
					#ifdef GLOBEMAP
						baseColor.rgb = textureCube(globeMap, normalize(vGlobeDirection)).rgb;
					#endif
					#ifdef GLOBECLOUDS
					{
						vec3 gcd = normalize(vGlobeDirection);
						float gcs = sin(globeCloudPhase);
						float gcc = cos(globeCloudPhase);
						gcd = vec3(gcc * gcd.x - gcs * gcd.z, gcd.y, gcs * gcd.x + gcc * gcd.z);

						float graw = textureCube(globeCloudAlphaMap, gcd).r;
						gGlobeCloud = clamp(
							mix(graw, 1.0 - graw, globeCloudAlphaInvert) * globeCloudOpacity,
							0.0, 1.0);

						baseColor.rgb = mix(baseColor.rgb,
							textureCube(globeCloudMap, gcd).rgb * globeCloudGain, gGlobeCloud);
					}
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
						gp = normalize(mix(gp, gn, gGlobeCloud));
						mat3 gWorld = mat3(vGlobeWorldX, vGlobeWorldY, vGlobeWorldZ);
						normalW = normalize(gWorld * gp);
					}
					#endif
				`,

				CUSTOM_FRAGMENT_BEFORE_FOG: `
					#ifdef GLOBENIGHT
					{
						mat3 gNightWorld = mat3(vGlobeWorldX, vGlobeWorldY, vGlobeWorldZ);
						vec3 gNightN = normalize(gNightWorld * normalize(vGlobeDirection));
						vec3 gSun = normalize(globeStarPosition - vPositionW);

						// Up over civil twilight, out by sunrise.
						float gDark = 1.0 - smoothstep(-globeNightBand, 0.0, dot(gNightN, gSun));

						// Cities do not shine through cloud.
						color.rgb += textureCube(globeNightMap, normalize(vGlobeDirection)).rgb
							* (gDark * globeNightLevel * (1.0 - gGlobeCloud));
					}
					#endif
				`,

				// NOTE(Emily): specularColor is declared after
				// CUSTOM_FRAGMENT_BEFORE_LIGHTS and consumed by the light
				// loop, with no injection point in between, so the declaration
				// itself gets rewritten. A leading "!" marks the key as a
				// regex to replace rather than a hook to insert before.
				"!vec3\\s+specularColor\\s*=\\s*vSpecularColor\\.rgb\\s*;": `
					vec3 specularColor = vSpecularColor.rgb;
					#ifdef GLOBESPECULAR
						specularColor *= textureCube(globeSpecularMask, normalize(vGlobeDirection)).r;
					#endif
					specularColor *= 1.0 - gGlobeCloud;
				`,

				// The star is not lit by anything, including itself.
				//
				// viewDirectionW is declared unconditionally at the top of
				// main(), so neither needs a new varying or uniform.
				CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
					#ifdef GLOBEEMISSIVE
					{
						mat3 gStarWorld = mat3(vGlobeWorldX, vGlobeWorldY, vGlobeWorldZ);
						vec3 starN = normalize(gStarWorld * normalize(vGlobeDirection));
						float mu = clamp(dot(starN, viewDirectionW), 0.0, 1.0);
						float omu = 1.0 - mu;

						// Quadratic limb darkening. At 550 nm the solar limb is
						// 0.30 of centre brightness.
						float limb = clamp(1.0 - globeLimbU1 * omu - globeLimbU2 * omu * omu, 0.0, 1.0);

						// Relatively cheesy churn -- it mutates a scan texture
						// so it looks a bit like the sun has a skin that's
						// being stirred but it's better than static.
						vec3 look = normalize(vGlobeDirection);
						#ifdef GLOBECHURN
						{
							float ct = globeTime * globeChurnSpeed;
							vec3 w1 = vec3(sin(look.y * 11.0 + ct),
							               sin(look.z * 11.0 + ct * 1.3),
							               sin(look.x * 11.0 + ct * 0.7));
							vec3 w2 = vec3(sin(look.z * 23.0 - ct * 1.7),
							               sin(look.x * 23.0 - ct * 1.1),
							               sin(look.y * 23.0 - ct * 1.9));
							look = normalize(look + (w1 * 0.7 + w2 * 0.3) * globeChurnAmount);
						}
						#endif

						vec3 star = textureCube(globeMap, look).rgb * globeTint * limb;

						// Chromosphere: an H-alpha rim. rho is the projected
						// radius, so the manifest's fraction is measured where
						// visible, rather than being hidden inside
						// a falloff exponent.
						float rho = sqrt(max(0.0, 1.0 - mu * mu));

						float rim = smoothstep(1.0 - globeChromoFraction, 1.0, rho);
						star = mix(star, globeChromoColor, rim * globeChromoStrength);

						color.rgb = star * globeEmissiveLevel;
					}
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
	tint?: Color3;
	limbDarkening?: { u1: number; u2: number };
	chromosphere?: { color: Color3; fractionOfRadius: number; strength: number };
	churn?: { amount: number; speed: number };
	// Diffuse multiplier.
	brightness?: number;
	specularMask?: string;
	specularReflectance?: number;
	// Specular exponent.
	glossiness?: number;
	clouds?: string;
	cloudsAlpha?: string;
	cloudOpacity?: number;
	cloudGain?: number;
	cloudAlphaIsInverted?: boolean;
	night?: string;
	nightLevel?: number;
	civilTwilightDeg?: number;
	starPosition?: Vector3;
}

// Fresnel reflectance at normal incidence for a dielectric in vacuum.
export function fresnel0(refractiveIndex: number): number {
	const r = (refractiveIndex - 1) / (refractiveIndex + 1);
	return r * r;
}

export function setCloudPhase(material: StandardMaterial, phase: number): void {
	const plugin = material.pluginManager?.getPlugin<BodyMapPlugin>("BodyMap");
	if (plugin) plugin.cloudPhase = phase;
}

export function bodyMaterial(scene: Scene, name: string, options: BodyMaterialOptions): StandardMaterial {
	const material = new StandardMaterial(name + "-mat", scene);

	const brightness = options.brightness ?? 1;
	material.diffuseColor = (options.baseColor ?? Color3.White()).scale(brightness);

	// Babylon's Blinn-Phong lobe is unnormalised. (n + 8) / 8pi puts the energy
	// back where it belongs.
	const reflectance = options.specularReflectance ?? 0.08;
	const glossiness = options.glossiness ?? 64;
	const peak = (reflectance * (glossiness + 8)) / (8 * Math.PI);

	material.specularColor = new Color3(peak, peak, peak);
	material.specularPower = glossiness;

	const plugin = new BodyMapPlugin(material);

	if (options.surface) {
		plugin.map = new CubeTexture(options.surface, scene);
	}

	if (options.bump) {
		plugin.bump = new CubeTexture(options.bump, scene);
		plugin.bumpStrength = options.bumpStrength ?? 0.2;
		plugin.bumpEpsilon = options.bumpEpsilon ?? 0.004;
	}

	if (options.specularMask) {
		plugin.specularMask = new CubeTexture(options.specularMask, scene);
	}

	if (options.clouds && options.cloudsAlpha) {
		plugin.cloudMap = new CubeTexture(options.clouds, scene);
		plugin.cloudAlpha = new CubeTexture(options.cloudsAlpha, scene);
		plugin.cloudOpacity = options.cloudOpacity ?? 1;
		plugin.cloudGain = options.cloudGain ?? 1;
		plugin.cloudAlphaInvert = options.cloudAlphaIsInverted ? 1 : 0;
	}

	if (options.night) {
		plugin.nightMap = new CubeTexture(options.night, scene);
		plugin.nightLevel = options.nightLevel ?? 1;
		plugin.nightBand = Math.sin((options.civilTwilightDeg ?? 6) * Math.PI / 180);
		if (options.starPosition) plugin.starPosition = options.starPosition.clone();
	}

	if (options.tint) plugin.tint = options.tint;

	if (options.emissive) {
		plugin.emissive = true;
		plugin.emissiveLevel = options.emissiveLevel ?? 1;
		material.disableLighting = true;

		if (options.limbDarkening) {
			plugin.limbU1 = options.limbDarkening.u1;
			plugin.limbU2 = options.limbDarkening.u2;
		}
		if (options.chromosphere) {
			plugin.chromoColor = options.chromosphere.color;
			plugin.chromoFraction = options.chromosphere.fractionOfRadius;
			plugin.chromoStrength = options.chromosphere.strength;
		}
		if (options.churn && options.churn.amount > 0) {
			plugin.churnAmount = options.churn.amount;
			plugin.churnSpeed = options.churn.speed;
			let elapsed = 0;
			scene.onBeforeRenderObservable.add(() => {
				elapsed += scene.getEngine().getDeltaTime() / SECOND;
				plugin.time = elapsed;
			});
		}
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

// Renders the sun's corona as a translucent shell around the star whose radial
// profile follows the Baumbach-Allen K-corona law.
//
// Using ray intersections through the shell to accumulate atmospheric light
// interactions.
//
class CoronaPlugin extends MaterialPluginBase {
	colour = new Color3(1, 1, 1);
	outerRadii = 3;
	intensity = 0.55;
	compression = 0.18;
	chromoColor = new Color3(0, 0, 0);
	chromoFraction = 0.0;
	chromoStrength = 0.0;

	constructor(material: Material) {
		super(material, "Corona", 210, { CORONA: false });
		this._enable(true);
	}

	getClassName(): string {
		return "CoronaPlugin";
	}

	prepareDefines(defines: MaterialDefines): void {
		defines["CORONA"] = true;
	}

	getUniforms(): { ubo: { name: string; size: number; type: string }[]; fragment: string } {
		return {
			ubo: [
				{ name: "coronaColor", size: 3, type: "vec3" },
				{ name: "coronaChromoColor", size: 3, type: "vec3" },
				{ name: "coronaOuter", size: 1, type: "float" },
				{ name: "coronaIntensity", size: 1, type: "float" },
				{ name: "coronaCompression", size: 1, type: "float" },
				{ name: "coronaChromoFraction", size: 1, type: "float" },
				{ name: "coronaChromoStrength", size: 1, type: "float" }
			],
			fragment:
				"uniform vec3 coronaColor;\n" +
				"uniform vec3 coronaChromoColor;\n" +
				"uniform float coronaOuter;\n" +
				"uniform float coronaIntensity;\n" +
				"uniform float coronaCompression;\n" +
				"uniform float coronaChromoFraction;\n" +
				"uniform float coronaChromoStrength;\n"
		};
	}

	bindForSubMesh(uniformBuffer: UniformBuffer): void {
		uniformBuffer.updateColor3("coronaColor", this.colour);
		uniformBuffer.updateColor3("coronaChromoColor", this.chromoColor);
		uniformBuffer.updateFloat("coronaChromoFraction", this.chromoFraction);
		uniformBuffer.updateFloat("coronaChromoStrength", this.chromoStrength);
		uniformBuffer.updateFloat("coronaOuter", this.outerRadii);
		uniformBuffer.updateFloat("coronaIntensity", this.intensity);
		uniformBuffer.updateFloat("coronaCompression", this.compression);
	}

	getCustomCode(shaderType: string, shaderLanguage?: ShaderLanguage): Nullable<{ [point: string]: string }> {
		if (shaderLanguage === ShaderLanguage.WGSL) return null;

		if (shaderType === "vertex") {
			return {
				CUSTOM_VERTEX_DEFINITIONS: `
					varying vec3 vCoronaPosition;
					varying vec3 vCoronaWorldX;
					varying vec3 vCoronaWorldY;
					varying vec3 vCoronaWorldZ;
				`,
				CUSTOM_VERTEX_MAIN_END: `
					vCoronaPosition = position;
					vCoronaWorldX = finalWorld[0].xyz;
					vCoronaWorldY = finalWorld[1].xyz;
					vCoronaWorldZ = finalWorld[2].xyz;
				`
			};
		}

		if (shaderType === "fragment") {
			return {
				CUSTOM_FRAGMENT_DEFINITIONS: `
					// How far the shell tucks inside rho = 1 to hide the star's
					// polygonal silhouette.
					#define CORONA_TUCK 0.985
					varying vec3 vCoronaPosition;
					varying vec3 vCoronaWorldX;
					varying vec3 vCoronaWorldY;
					varying vec3 vCoronaWorldZ;
				`,
				// The shell is built with its radius in stellar radii and then
				// scaled by the star's scene radius, so working in OBJECT space
				// means lengths are already in stellar radii with no conversion.
				CUSTOM_FRAGMENT_BEFORE_FRAGCOLOR: `
					#ifdef CORONA
					{
						// Work backwards to get the eye dir in object view.
						vec3 d = mat3(vCoronaWorldX, vCoronaWorldY, vCoronaWorldZ) * vCoronaPosition;
						vec3 centre = vPositionW - d;
						vec3 rel = vEyePosition.xyz - centre;
						float s2 = max(dot(vCoronaWorldX, vCoronaWorldX), 1e-8);
						vec3 eyeObj = vec3(dot(rel, vCoronaWorldX),
						                   dot(rel, vCoronaWorldY),
						                   dot(rel, vCoronaWorldZ)) / s2;

						// Distance from the star's centre to the line of sight.
						vec3 ray = vCoronaPosition - eyeObj;
						float rho = length(cross(eyeObj, vCoronaPosition)) / max(length(ray), 1e-5);

						float facing = dot(vCoronaPosition, eyeObj - vCoronaPosition);
						float farSide = 1.0 - step(0.0, facing);

						float r = max(rho, 1.0);
						float B = 0.0532 * pow(r, -2.5)
						        + 1.425  * pow(r, -7.0)
						        + 2.565  * pow(r, -17.0);
						float a = pow(clamp(B / 4.0432, 0.0, 1.0), coronaCompression);

						// Inside rho = 1; rho is analytic wrapping a polygon
						// whose silhouette sits a bit inside the mathematical
						// sphere. A little bit of overlap avoids a dark ring
						// artefact at the contact point.
						a *= smoothstep(CORONA_TUCK, 1.0, rho);
						a *= 1.0 - smoothstep(coronaOuter * 0.5, coronaOuter, rho);

						// Chromosphere band.
						float band = smoothstep(CORONA_TUCK, 1.0, rho) * (1.0 - smoothstep(1.0, 1.0 + coronaChromoFraction, rho));

						float ca = a * coronaIntensity;
						float ha = band * coronaChromoStrength;
						float sum = (ca + ha) * farSide;
						color.rgb = sum > 0.0 ? (coronaColor * ca + coronaChromoColor * ha) / sum : vec3(0.0);

						// Some cheap dithering to avoid harsh banding in the corona.
						float ign = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
						color.a = clamp(sum + (ign - 0.5) / 255.0, 0.0, 1.0);
					}
					#endif
				`
			};
		}

		return null;
	}
}

export interface CoronaMaterialOptions {
	color: Color3;
	outerRadii: number;
	intensity: number;
	toneCompression: number;
	chromosphere?: { color: Color3; fractionOfRadius: number; strength: number };
	churn?: { amount: number; speed: number };
}

export function coronaMaterial(scene: Scene, name: string, options: CoronaMaterialOptions): StandardMaterial {
	const material = new StandardMaterial(name + "-mat", scene);
	material.disableLighting = true;
	material.diffuseColor = Color3.Black();
	material.specularColor = Color3.Black();

	material.alphaMode = Constants.ALPHA_ADD;
	material.transparencyMode = Material.MATERIAL_ALPHABLEND;
	material.disableDepthWrite = true;
	material.backFaceCulling = false;

	const plugin = new CoronaPlugin(material);
	plugin.colour = options.color;
	plugin.outerRadii = options.outerRadii;
	plugin.intensity = options.intensity;
	plugin.compression = options.toneCompression;
	if (options.chromosphere) {
		plugin.chromoColor = options.chromosphere.color;
		plugin.chromoFraction = options.chromosphere.fractionOfRadius;
		plugin.chromoStrength = options.chromosphere.strength;
	}

	material.markAsDirty(Material.TextureDirtyFlag);
	return material;
}
