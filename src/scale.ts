import { BODIES, type Body } from "./bodies.js";

// The solar system does not fit in a scene -- we've got to do a decent bit of
// magic scale compression.

export const AU_KM = 149_597_870.7;
export const EARTH_RADIUS_KM = 6371.0;

// Mercury and Plutos' lanes.
export const ORBIT_MIN = 6;
export const ORBIT_MAX = 40;
export const ORBIT_POWER = 0.4;

export const EARTH_RADIUS_SCENE = 0.45;
export const RADIUS_POWER = 0.4;

export const MIN_RADIUS = 0.08;

// Sun just has a fixed radius.
export const SUN_RADIUS = 2.2;

export const MOON_MIN_GAP = 1.9;
export const MOON_MAX_GAP = 2.6;

// Seconds per lap / per turn.
export const EARTH_YEAR_SECONDS = 20;
export const EARTH_DAY_SECONDS = 6;
export const ORBIT_TIME_POWER = 0.5;
export const SPIN_TIME_POWER = 0.5;

// Moons need a shallower curve otherwise Phobos and Deimos would be orbiting
// at lightning speed.
export const MOON_TIME_POWER = 0.25;
export const MOON_YEAR_SECONDS = 8;

const helio = BODIES.filter(b => b.parent === "sun" && b.orbit);
const auOf = (b: Body): number => b.orbit!.semiMajorAxisKm / AU_KM;
const ORBIT_LO = Math.min(...helio.map(b => auOf(b) ** ORBIT_POWER));
const ORBIT_HI = Math.max(...helio.map(b => auOf(b) ** ORBIT_POWER));

export function orbitRadius(semiMajorAxisKm: number): number {
	const t = ((semiMajorAxisKm / AU_KM) ** ORBIT_POWER - ORBIT_LO) / (ORBIT_HI - ORBIT_LO);
	return ORBIT_MIN + t * (ORBIT_MAX - ORBIT_MIN);
}

export function bodyRadius(body: Body): number {
	if (body.kind === "star") return SUN_RADIUS;

	const scaled = EARTH_RADIUS_SCENE * (body.meanRadiusKm / EARTH_RADIUS_KM) ** RADIUS_POWER;
	return Math.max(MIN_RADIUS, scaled);
}

const ratioOf = (b: Body, parent: Body): number =>
	b.orbit!.semiMajorAxisKm / parent.meanRadiusKm;

export function moonOrbitRadius(moon: Body, parent: Body): number {
	const siblings = BODIES.filter(b => b.parent === parent.id && b.orbit);
	const ratios = siblings.map(b => Math.log10(ratioOf(b, parent)));
	const lo = Math.min(...ratios);
	const hi = Math.max(...ratios);
	const t = hi > lo ? (Math.log10(ratioOf(moon, parent)) - lo) / (hi - lo) : 0.5;
	return bodyRadius(parent) * (MOON_MIN_GAP + t * (MOON_MAX_GAP - MOON_MIN_GAP));
}

export function orbitPeriodSeconds(body: Body, aroundSun: boolean): number {
	const days = body.orbit!.periodDays;
	return aroundSun
		? EARTH_YEAR_SECONDS * (days / 365.256) ** ORBIT_TIME_POWER
		: MOON_YEAR_SECONDS * (days / 27.3217) ** MOON_TIME_POWER;
}

export function spinPeriodSeconds(body: Body): number {
	const hours = Math.abs(body.rotationPeriodHours);
	return EARTH_DAY_SECONDS * (hours / 23.9345) ** SPIN_TIME_POWER;
}

export function sphereDetail(sceneRadius: number): number {
	if (sceneRadius < 0.12) return 4;
	if (sceneRadius < 0.5) return 8;
	return 16;
}

export function textureBudget(sceneRadius: number): number {
	if (sceneRadius < 0.15) return 512;
	if (sceneRadius < 0.5) return 1024;
	return 2048;
}
