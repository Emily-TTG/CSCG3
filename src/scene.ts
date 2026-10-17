import {
	CubeTexture,
	MeshBuilder,
	Scene,
	StandardMaterial,
	Texture,
	TransformNode,
	Vector3
} from "@babylonjs/core";

import {
	joint,
	ball,
	bone,
	COLORS
} from "./geometry.js";

import {
	asset,
	SECOND,
	TWO_PI
} from "./utility.js";

const WALK_RADIUS = 4;
const LAP = 12;
const STRIDES_PER_LAP = 16;

const SKYBOX_ORBIT = 0.005;

// NOTE(Emily): The gait of the figure is a little lopsided/limping. Not fully
//              sure what's causing it.

const UP = -Math.PI / 2;
const DOWN = Math.PI / 2;

const JOINT_SWELL = 1.3;

const PELVIS_HEIGHT = 1.9;
const THIGH = 0.75;
const SHIN = 0.7;
const LEG = THIGH + SHIN;

const STEP = (TWO_PI * WALK_RADIUS) / STRIDES_PER_LAP;

const STANCE_BIAS = 0.5;
const STANCE_FRACTION = 0.64;

const HIP_SWING = Math.asin(Math.min(1, (STANCE_FRACTION * STEP) / (2 * LEG)));

const KNEE_SWING = 1.0;
const KNEE_SHARPNESS = 9;
const KNEE_LEAD = 0.8;
const KNEE_STANCE = 0.05;

const SHOULDER_SWING = 0.9 * HIP_SWING;
const ELBOW_FORWARD = 0.5;
const ELBOW_BACK = 0.15;

const BOB = THIGH + SHIN * Math.cos(KNEE_STANCE) - LEG * Math.cos(HIP_SWING);

const phase = (phase: number): number => phase + STANCE_BIAS * Math.sin(phase);
const bump = (phase: number, sharpness: number): number => Math.sin(phase / 2) ** (2 * sharpness);

interface Motion {
	phase: number;
	sweep: number;
	// -1 backwards, +1 forwards.
	fold: number;
	swingFlex: number;
	stanceFlex: number;
	lead: number;
	sharpness: number;
}

interface Shape {
	at: Vector3;
	upperRadius: number;
	upperLength: number;
	lowerRadius: number;
	lowerLength: number;
	endRadius: number;
}

interface Limb extends Motion {
	base: TransformNode;
	hinge: TransformNode;
}

// base -> upper bone -> hinge -> lower bone -> hand or foot.
function limb(scene: Scene, parent: TransformNode, shape: Shape, motion: Motion): Limb {
	const base = joint(scene, parent, shape.at);
	base.rotation.x = DOWN;
	ball(scene, base, shape.upperRadius * JOINT_SWELL, COLORS.yellow);
	bone(scene, base, shape.upperRadius, shape.upperLength, COLORS.blue);

	const hinge = joint(scene, base, new Vector3(0, 0, shape.upperLength));
	ball(scene, hinge, shape.lowerRadius * JOINT_SWELL, COLORS.yellow);
	bone(scene, hinge, shape.lowerRadius, shape.lowerLength, COLORS.blue);

	const end = joint(scene, hinge, new Vector3(0, 0, shape.lowerLength));
	ball(scene, end, shape.endRadius, COLORS.cyan);

	return { base, hinge, ...motion };
}

export function figure(scene: Scene): void {
	const anchor = new TransformNode("figure-anchor", scene, true);

	const pelvis = joint(scene, anchor, new Vector3(WALK_RADIUS, PELVIS_HEIGHT, 0));
	ball(scene, pelvis, 0.35, COLORS.green);

	const chest = joint(scene, pelvis, new Vector3(0, 0.75, 0));
	ball(scene, chest, 0.45, COLORS.green);

	const neck = joint(scene, chest, new Vector3(0, 0.45, 0));
	neck.rotation.x = UP;
	bone(scene, neck, 0.12, 0.3, COLORS.orange);

	const head = joint(scene, neck, new Vector3(0, 0, 0.55));
	ball(scene, head, 0.33, COLORS.red);

	const limbs: Limb[] = [];
	for (const side of [1, -1]) {
		// Opposite arm and leg swing together, so they share a phase.
		const near = side > 0 ? 0 : Math.PI;
		const far = Math.PI - near;

		limbs.push(limb(scene, chest, {
			at: new Vector3(side * 0.6, 0.35, 0),
			upperRadius: 0.12,
			upperLength: 0.6,
			lowerRadius: 0.1,
			lowerLength: 0.55,
			endRadius: 0.14
		}, {
			phase: far,
			sweep: SHOULDER_SWING,
			fold: 1,
			swingFlex: ELBOW_FORWARD,
			stanceFlex: ELBOW_BACK,
			lead: 0,
			sharpness: 1
		}));

		limbs.push(limb(scene, pelvis, {
			at: new Vector3(side * 0.25, -0.15, 0),
			upperRadius: 0.16,
			upperLength: THIGH,
			lowerRadius: 0.13,
			lowerLength: SHIN,
			endRadius: 0.18
		}, {
			phase: near,
			sweep: HIP_SWING,
			fold: -1,
			swingFlex: KNEE_SWING,
			stanceFlex: KNEE_STANCE,
			lead: KNEE_LEAD,
			sharpness: KNEE_SHARPNESS
		}));
	}

	// One clock for the lap, the stride, the bob and every joint angle, so
	// that nothing can drift out of step with the distance travelled.
	let elapsed = 0;
	scene.onBeforeRenderObservable.add(() => {
		elapsed += scene.getEngine().getDeltaTime() / SECOND;

		const theta = (TWO_PI / LAP) * elapsed;
		const stride = theta * STRIDES_PER_LAP;

		anchor.rotation.y = theta;
		// Twice a stride: once over each planted foot.
		pelvis.position.y = PELVIS_HEIGHT + BOB * Math.cos(phase(stride)) ** 2;

		for (const l of limbs) {
			const psi = phase(stride + l.phase);
			l.base.rotation.x = DOWN + l.sweep * Math.sin(psi);
			l.hinge.rotation.x = l.fold * (
				l.swingFlex * bump(psi + Math.PI + l.lead, l.sharpness) +
				l.stanceFlex * bump(psi, 1));
		}
	});
}

// Based on https://www.babylonjs-playground.com/#UU7RQ#245.
// Skybox from https://tools.wwwtyro.net/space-3d/index.html.
export function sky(scene: Scene): void {
	const material = new StandardMaterial("skyBox", scene);
	material.backFaceCulling = false;
	material.disableLighting = true;

	material.reflectionTexture = new CubeTexture(asset("assets/skybox/space"), scene, [
		"_right.png", "_top.png", "_front.png",
		"_left.png", "_bottom.png", "_back.png"
	]);
	material.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;

	const skybox = MeshBuilder.CreateBox("skybox", {
		size: 500.0
	}, scene);
	skybox.material = material;
	skybox.infiniteDistance = true;

	scene.onBeforeRenderObservable.add(() => {
		skybox.rotation.y += (SKYBOX_ORBIT / SECOND) * scene.getEngine().getDeltaTime();
	});
}
