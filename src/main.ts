import {
	ArcRotateCamera,
	Color3,
	Engine,
	HemisphericLight,
	PointLight,
	Scene,
	Tools,
	Vector3
} from "@babylonjs/core";

import {
	figure,
	sky
} from "./scene.js";

import { system } from "./orrery.js";

const canvas = document.getElementById("surface") as HTMLCanvasElement;
const engine = new Engine(canvas, true, undefined, true);
const scene = new Scene(engine);

const camera = new ArcRotateCamera("camera", Tools.ToRadians(215), Tools.ToRadians(72), 13, new Vector3(0, 2.2, 0), scene);
camera.attachControl(canvas, true);
camera.lowerRadiusLimit = 0.5;
camera.upperRadiusLimit = 140;
camera.minZ = 0.05;
camera.wheelDeltaPercentage = 0.02;

sky(scene);
figure(scene);

const solar = system(scene);

const sun = new PointLight("sun", Vector3.Zero(), scene);
sun.intensity = 1.1;

const starlight = new HemisphericLight("starlight", new Vector3(0, 1, 0), scene);
starlight.intensity = 0.06;
starlight.groundColor = new Color3(0.02, 0.02, 0.04);

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
