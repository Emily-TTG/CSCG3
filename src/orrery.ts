import {
	Color3,
	Mesh,
	Scene,
	StandardMaterial,
	Tools,
	TransformNode,
	Vector3
} from "@babylonjs/core";

import {
	BODIES,
	pickVariant,
	stripVariant,
	type Body
} from "./bodies.js";

import { GeometryBuffer, mesh } from "./geometry.js";
import { sphere, annulus } from "./solids.js";
import { bodyMaterial, coronaMaterial, fresnel0, ringMaterial, setCloudPhase } from "./globe.js";
import { asset, SECOND, TWO_PI } from "./utility.js";

import {
	bodyRadius,
	moonOrbitRadius,
	orbitPeriodSeconds,
	orbitRadius,
	periodSeconds,
	sphereDetail,
	spinPeriodSeconds,
	textureBudget
} from "./scale.js";

const RING_SEGMENTS = 96;
const CORONA_DETAIL = 12;
const TIME_SCALE = 0.15;

const ALBEDO_COMPRESSION = 0.5;
const ALBEDO_REFERENCE = Math.max(...BODIES.map(b => b.reflectance?.geometricAlbedo ?? 0));

const brightnessOf = (geometricAlbedo: number): number =>
	(geometricAlbedo / ALBEDO_REFERENCE) ** ALBEDO_COMPRESSION;

// Irrationals to avoid weird repeats.
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const NODE_ANGLE = Math.PI * (Math.sqrt(2) - 1);

export interface BodyNodes {
	body: Body;
	// Inclination and ascending node.
	plane: TransformNode;
	// Orbital pivot.
	pivot: TransformNode;
	// The body's own centre for satellites.
	centre: TransformNode;
	tilt: TransformNode;
	spin: TransformNode;
	mesh: Mesh;
	sceneRadius: number;
}

export interface SolarSystem {
	root: TransformNode;
	nodes: Map<string, BodyNodes>;
}

interface Spinner {
	node: TransformNode;
	rate: number;
	phase: number;
}

interface Drifter {
	material: StandardMaterial;
	rate: number;
}

function faceSize(sourceWidth: number): number {
	return 2 ** Math.round(Math.log2(Math.max(sourceWidth / 4, 16)));
}

function materialFor(scene: Scene, body: Body, sceneRadius: number) {
	const budget = textureBudget(sceneRadius);
	const surface = pickVariant(body.textures.surface, budget);
	const bump = pickVariant(body.textures.bump, budget);
	const specular = pickVariant(body.textures.specular, budget);
	const clouds = pickVariant(body.textures.clouds, budget);
	const night = pickVariant(body.textures.night, budget);
	const cloudsAlpha = pickVariant(body.textures.cloudsAlpha, budget);

	const star = body.star;
	const reflectance = body.reflectance;
	const cloudLayer = body.cloudLayer;
	const nightLights = body.nightLights;

	return bodyMaterial(scene, body.id, {
		surface: surface ? asset(surface.cube!) : undefined,
		bump: bump ? asset(bump.cube!) : undefined,
		bumpEpsilon: bump ? 2 / faceSize(bump.width) : undefined,
		specularMask: specular ? asset(specular.cube!) : undefined,
		clouds: clouds && cloudLayer ? asset(clouds.cube!) : undefined,
		cloudsAlpha: cloudsAlpha && cloudLayer ? asset(cloudsAlpha.cube!) : undefined,
		cloudOpacity: cloudLayer?.opacity,
		cloudAlphaIsInverted: cloudLayer?.alphaIsInverted,
		night: night && nightLights ? asset(night.cube!) : undefined,
		nightLevel: nightLights?.level,
		civilTwilightDeg: nightLights?.civilTwilightDeg,
		starPosition: Vector3.Zero(),
		cloudGain: cloudLayer && reflectance
			? brightnessOf(cloudLayer.geometricAlbedo) / brightnessOf(reflectance.geometricAlbedo)
			: undefined,
		brightness: reflectance ? brightnessOf(reflectance.geometricAlbedo) : undefined,
		// Fresnel off the real material, minus whatever roughness scatters away.
		specularReflectance: reflectance
			? fresnel0(reflectance.refractiveIndex) * reflectance.smoothness
			: undefined,
		glossiness: reflectance?.glossiness,
		baseColor: body.material?.baseColor
			? Color3.FromHexString(body.material.baseColor)
			: undefined,
		emissive: body.material?.emissive === true,
		tint: star ? Color3.FromHexString(star.tint) : undefined,
		limbDarkening: star?.limbDarkening,
		chromosphere: star ? {
			color: Color3.FromHexString(star.chromosphere.color),
			fractionOfRadius: star.chromosphere.renderFractionOfRadius,
			strength: star.chromosphere.innerRimStrength
		} : undefined,
		churn: star?.churn
	});
}

function addRing(scene: Scene, body: Body, sceneRadius: number, tilt: TransformNode): Mesh | null {
	if (!body.ring) return null;

	const colour = stripVariant(body.textures.ringColor);
	if (!colour) return null;

	// Keep the ring's true proportion to its planet, even though the planet's
	// own radius is compressed.
	const inner = sceneRadius * (body.ring.innerRadiusKm / body.meanRadiusKm);
	const outer = sceneRadius * (body.ring.outerRadiusKm / body.meanRadiusKm);

	const buf = new GeometryBuffer();
	annulus(buf, inner, outer, RING_SEGMENTS);

	const alpha = stripVariant(body.textures.ringAlpha);
	const material = ringMaterial(scene, body.id + "-ring", {
		colour: asset(colour.file),
		alpha: alpha ? asset(alpha.file) : undefined,
		innerRadius: inner,
		outerRadius: outer
	});

	// Parented to tilt, not spin: an annulus and a radial strip are both
	// rotationally symmetric, so spinning one is invisible work.
	return mesh(scene, body.id + "-ring", buf, tilt, material);
}

function addCorona(scene: Scene, body: Body, sceneRadius: number, centre: TransformNode): Mesh | null {
	const corona = body.star?.corona;
	if (!corona) return null;

	const buf = new GeometryBuffer();
	sphere(buf, corona.outerRadii, CORONA_DETAIL);

	const built = mesh(scene, body.id + "-corona", buf, centre,
		coronaMaterial(scene, body.id + "-corona", {
			color: Color3.FromHexString(corona.color),
			outerRadii: corona.outerRadii,
			intensity: corona.intensity,
			toneCompression: corona.toneCompression,
			chromosphere: {
				color: Color3.FromHexString(body.star!.chromosphere.color),
				fractionOfRadius: body.star!.chromosphere.renderFractionOfRadius,
				strength: body.star!.chromosphere.strength
			}
		}));

	built.scaling = new Vector3(sceneRadius, sceneRadius, sceneRadius);
	built.isPickable = false;
	return built;
}

// plane -> pivot -> centre -> tilt -> spin -> mesh
export function system(scene: Scene): SolarSystem {
	const root = new TransformNode("solar-system", scene, true);
	const nodes = new Map<string, BodyNodes>();
	const spinners: Spinner[] = [];
	const drifters: Drifter[] = [];

	const byId = new Map(BODIES.map(b => [b.id, b]));
	const children = new Map<string | null, Body[]>();
	for (const body of BODIES) {
		const siblings = children.get(body.parent) ?? [];
		siblings.push(body);
		children.set(body.parent, siblings);
	}

	let index = 0;

	const build = (body: Body, attachTo: TransformNode): void => {
		const seq = index++;
		const sceneRadius = bodyRadius(body);
		const parent = body.parent !== null ? byId.get(body.parent)! : null;

		const plane = new TransformNode(body.id + "-plane", scene, true);
		plane.parent = attachTo;

		const pivot = new TransformNode(body.id + "-pivot", scene, true);
		pivot.parent = plane;

		const centre = new TransformNode(body.id + "-centre", scene, true);
		centre.parent = pivot;

		if (body.orbit && parent) {
			const aroundStar = parent.kind === "star";
			plane.rotation.x = Tools.ToRadians(body.orbit.inclinationDeg);
			plane.rotation.y = NODE_ANGLE * seq; // ascending node, spread deterministically

			centre.position = new Vector3(
				aroundStar ? orbitRadius(body.orbit.semiMajorAxisKm) : moonOrbitRadius(body, parent),
				0, 0);

			spinners.push({
				node: pivot,
				rate: TWO_PI / orbitPeriodSeconds(body, aroundStar),
				phase: GOLDEN_ANGLE * seq
			});
		}

		const tilt = new TransformNode(body.id + "-tilt", scene, true);
		tilt.parent = centre;
		tilt.rotation.z = Tools.ToRadians(body.axialTiltDeg);

		const spin = new TransformNode(body.id + "-spin", scene, true);
		spin.parent = tilt;
		spinners.push({
			node: spin,
			rate: TWO_PI / spinPeriodSeconds(body),
			phase: GOLDEN_ANGLE * seq
		});

		const buf = new GeometryBuffer();
		sphere(buf, sceneRadius, sphereDetail(sceneRadius));
		const bodyMat = materialFor(scene, body, sceneRadius);
		const built = mesh(scene, body.id, buf, spin, bodyMat);

		if (body.cloudLayer) {
			drifters.push({
				material: bodyMat,
				rate: TWO_PI / periodSeconds(body.cloudLayer.driftPeriodHours)
			});
		}

		addRing(scene, body, sceneRadius, tilt);
		addCorona(scene, body, sceneRadius, centre);

		nodes.set(body.id, { body, plane, pivot, centre, tilt, spin, mesh: built, sceneRadius });

		// Moons hang off centre, so the planet's own rotation does not drag them.
		for (const child of children.get(body.id) ?? []) build(child, centre);
	};

	for (const star of children.get(null) ?? []) build(star, root);

	// Doing it all at once keeps things nicely in sync.
	let elapsed = 0;
	scene.onBeforeRenderObservable.add(() => {
		elapsed += (scene.getEngine().getDeltaTime() / SECOND) * TIME_SCALE;
		for (const spinner of spinners) {
			spinner.node.rotation.y = spinner.phase + spinner.rate * elapsed;
		}
		for (const drifter of drifters) {
			setCloudPhase(drifter.material, drifter.rate * elapsed);
		}
	});

	return { root, nodes };
}
