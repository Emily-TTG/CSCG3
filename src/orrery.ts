import {
	Color3,
	Mesh,
	Scene,
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
import { bodyMaterial, ringMaterial } from "./globe.js";
import { asset, SECOND, TWO_PI } from "./utility.js";

import {
	bodyRadius,
	moonOrbitRadius,
	orbitPeriodSeconds,
	orbitRadius,
	sphereDetail,
	spinPeriodSeconds,
	textureBudget
} from "./scale.js";

const RING_SEGMENTS = 96;
const TIME_SCALE = 0.15;

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

function faceSize(sourceWidth: number): number {
	return 2 ** Math.round(Math.log2(Math.max(sourceWidth / 4, 16)));
}

function materialFor(scene: Scene, body: Body, sceneRadius: number) {
	const budget = textureBudget(sceneRadius);
	const surface = pickVariant(body.textures.surface, budget);
	const bump = pickVariant(body.textures.bump, budget);

	return bodyMaterial(scene, body.id, {
		surface: surface ? asset(surface.cube!) : undefined,
		bump: bump ? asset(bump.cube!) : undefined,
		bumpEpsilon: bump ? 2 / faceSize(bump.width) : undefined,
		baseColor: body.material?.baseColor
			? Color3.FromHexString(body.material.baseColor)
			: undefined,
		emissive: body.material?.emissive === true
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

// plane -> pivot -> centre -> tilt -> spin -> mesh
export function system(scene: Scene): SolarSystem {
	const root = new TransformNode("solar-system", scene, true);
	const nodes = new Map<string, BodyNodes>();
	const spinners: Spinner[] = [];

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
		const built = mesh(scene, body.id, buf, spin, materialFor(scene, body, sceneRadius));

		const ring = addRing(scene, body, sceneRadius, tilt);

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
	});

	return { root, nodes };
}
