import raw from "./data/bodies.json";

export type BodyKind = "star" | "planet" | "moon" | "dwarfPlanet";

export type TextureRole =
	| "surface" | "bump" | "normal" | "specular"
	| "night" | "clouds" | "cloudsAlpha"
	| "ringColor" | "ringAlpha";

// NOTE: Need a bunch of variant handling since TypeScript is strict on object
//       membership even from JSON data sources.

export interface Variant {
	file?: string;
	width: number;
	height: number;
	greyscale: boolean;
	projection: "equirectangular" | "ringStrip";
	cube?: string;
	derived?: boolean;
}

export interface Orbit {
	semiMajorAxisKm: number;
	eccentricity: number;
	inclinationDeg: number;
	periodDays: number;
}

export interface BodyMaterial {
	emissive?: boolean;
	baseColor?: string;
}

export interface Reflectance {
	bondAlbedo?: number;
	geometricAlbedo: number;
	refractiveIndex: number;
	smoothness: number;
	glossiness: number;
}

export interface CloudLayer {
	geometricAlbedo: number;
	trueFractionOfRadius: number;
	driftPeriodHours: number;
	opacity: number;
	alphaIsInverted?: boolean;
}

export interface NightLights {
	civilTwilightDeg: number;
	level: number;
}

export interface LimbDarkening {
	u1: number;
	u2: number;
}

export interface Chromosphere {
	thicknessKm: number;
	trueFractionOfRadius: number;
	renderFractionOfRadius: number;
	exaggeration: number;
	color: string;
	strength: number;
	innerRimStrength: number;
}

export interface Corona {
	outerRadii: number;
	color: string;
	intensity: number;
	toneCompression: number;
}

export interface StarProfile {
	effectiveTempK: number;
	photosphereColor: string;
	tint: string;
	limbDarkening: LimbDarkening;
	chromosphere: Chromosphere;
	corona: Corona;
	churn?: { amount: number; speed: number };
}

export interface Ring {
	innerRadiusKm: number;
	outerRadiusKm: number;
}

export interface Body {
	id: string;
	name: string;
	kind: BodyKind;
	parent: string | null;
	meanRadiusKm: number;
	rotationPeriodHours: number;
	axialTiltDeg: number;
	orbit?: Orbit;
	material?: BodyMaterial;
	reflectance?: Reflectance;
	cloudLayer?: CloudLayer;
	nightLights?: NightLights;
	ring?: Ring;
	star?: StarProfile;
	textures: Partial<Record<TextureRole, Variant[]>>;
}

interface Manifest {
	bodies: Body[];
}

export const BODIES: readonly Body[] = (raw as unknown as Manifest).bodies;

// Choose biggest texture we can fit.
export function pickVariant(variants: Variant[] | undefined, maxWidth: number): Variant | undefined {
	const usable = (variants ?? []).filter(v => v.cube !== undefined);
	if (usable.length === 0) return undefined;
	return usable.find(v => v.width <= maxWidth) ?? usable[usable.length - 1];
}

export interface StripVariant extends Variant {
	file: string;
}

// The 2D strip variant for rings.
export function stripVariant(variants: Variant[] | undefined): StripVariant | undefined {
	return (variants ?? []).find(
		(v): v is StripVariant => v.projection === "ringStrip" && typeof v.file === "string");
}
