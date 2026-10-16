import raw from "./data/bodies.json";

export type BodyKind = "star" | "planet" | "moon" | "dwarfPlanet";

export type TextureRole =
	| "surface" | "bump" | "normal" | "specular"
	| "night" | "clouds" | "cloudsAlpha"
	| "ringColor" | "ringAlpha";

// NOTE: Need a bunch of variant handling since TypeScript is strict on object
//       membership even from JSON data sources.

export interface Variant {
	file: string;
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
	albedo?: number;
	baseColor?: string;
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
	ring?: Ring;
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

// The 2D strip variant for rings.
export function stripVariant(variants: Variant[] | undefined): Variant | undefined {
	return (variants ?? []).find(v => v.projection === "ringStrip");
}
