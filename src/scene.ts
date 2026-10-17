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
	SECOND
} from "./utility.js";

const WALK_RADIUS = 4;
const LAP = 12;
const STRIDES_PER_LAP = 16;

const SKYBOX_ORBIT = 0.005;


const UP = -Math.PI / 2;

// TODO 3: swing the limbs so that it walks rather than slides.
//   - drive the swing from a sine wave whose phase advances with theta,
//     so the steps stay in step with the distance travelled
//   - opposite arm and leg swing together
//   - knees and elbows bend only one way: think about how to do that
//   - when `walking` is false, all joint angles are 0
// Set the angles on figure.joints.<name>.rotation.x

export function figure(scene: Scene): void {
	const anchor = new TransformNode("figure-anchor", scene, true);

	scene.onBeforeRenderObservable.add(() => {
		anchor.rotation.y += ((2 * Math.PI) / (LAP * SECOND)) * scene.getEngine().getDeltaTime();
	});

	const root = joint(scene, anchor, new Vector3(WALK_RADIUS, 1.9, 0));
	ball(scene, root, 0.35, COLORS.green);

	const chest = joint(scene, root, new Vector3(0, 0.75, 0));
	ball(scene, chest, 0.45, COLORS.green);

	const neck = joint(scene, chest, new Vector3(0, 0.45, 0));
	neck.rotation.x = UP;
	bone(scene, neck, 0.12, 0.3, COLORS.orange);

	const head = joint(scene, neck, new Vector3(0, 0, 0.55));
	ball(scene, head, 0.33, COLORS.red);

	/* ---- TODO: arms -------------------------------------------------- */
	// For each side (left and right):
	//   shoulder joint on the chest, at about (±0.6, 0.35, 0), with a ball
	//   an upper arm bone hanging down (radius ~0.12, length ~0.6)
	//   an elbow joint at the end of that bone, with a ball
	//   a forearm bone (radius ~0.1, length ~0.55)
	//   a hand ball at the end of the forearm
	// Write it once as a helper function and call it twice, with a side of
	// +1 and −1, rather than copying the code.

	/* ---- TODO: legs -------------------------------------------------- */
	// For each side, hanging off the root (the pelvis):
	//   hip joint at about (±0.25, −0.15, 0), with a ball
	//   a thigh bone hanging down (radius ~0.16, length ~0.75)
	//   a knee joint at the end of the thigh, with a ball
	//   a shin bone (radius ~0.13, length ~0.7)
	//   a foot ball at the end of the shin
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
