import {
	Color3,
	Material,
	Mesh,
	Scene,
	StandardMaterial,
	TransformNode,
	Vector3,
	VertexData
} from "@babylonjs/core";

import {
	cylinder,
	sphere
} from "./solids.js";

import { id } from "./utility.js";

const WELD = 1e5;

export class GeometryBuffer {
	readonly positions: number[] = [];
	readonly normals: number[] = [];
	readonly indices: number[] = [];

	private readonly seen = new Map<string, number>();

	vertex(position: Vector3, normal: Vector3): number {
		const key = `${q(position.x)},${q(position.y)},${q(position.z)}` +
			`|${q(normal.x)},${q(normal.y)},${q(normal.z)}`;

		const already = this.seen.get(key);
		if (already !== undefined) return already;

		const index = this.positions.length / 3;
		this.positions.push(position.x, position.y, position.z);
		this.normals.push(normal.x, normal.y, normal.z);
		this.seen.set(key, index);

		return index;
	}

	triangle(a: number, b: number, c: number): void {
		this.indices.push(a, b, c);
	}

	quad(a: number, b: number, c: number, d: number): void {
		this.triangle(a, b, c);
		this.triangle(a, c, d);
	}

	get vertexCount(): number {
		return this.positions.length / 3;
	}

	get triangleCount(): number {
		return this.indices.length / 3;
	}

	toMesh(name: string, scene: Scene): Mesh | null {
		if (this.triangleCount === 0) return null;

		const vertexData = new VertexData();
		vertexData.positions = this.positions;
		vertexData.normals = this.normals;
		vertexData.indices = this.indices;

		const mesh = new Mesh(name, scene);
		vertexData.applyToMesh(mesh);

		return mesh;
	}
}

const q = (v: number): number => Math.round(v * WELD);

export const COLORS = {
	red: new Color3(1, 0, 0),
	green: new Color3(0, 0.7, 0.2),
	blue: new Color3(0.2, 0.4, 1),
	yellow: new Color3(1, 0.85, 0),
	orange: new Color3(1, 0.5, 0),
	magenta: new Color3(1, 0, 1),
	cyan: new Color3(0, 0.8, 0.9),
	grey: new Color3(0.6, 0.6, 0.6),
	white: new Color3(1, 1, 1)
} as const satisfies Record<string, Color3>;

// Grid steps per cube face for `ball()`.
const SPHERE_DETAIL = 6;
const CYLINDER_SEGMENTS = 20;

export function joint(
	scene: Scene,
	parent: TransformNode | null = null,
	position: Vector3 | null = null): TransformNode {

	const node = new TransformNode(id(), scene);
	if (parent) node.parent = parent;
	if (position) node.position = position.clone();
	return node;
}

export function ball(
	scene: Scene,
	parent: TransformNode | null,
	radius: number,
	color: Color3,
	detail: number = SPHERE_DETAIL): void {

	const buf = new GeometryBuffer();
	sphere(buf, radius, detail);
	finish(scene, id(), buf, parent, color);
}

export function bone(
	scene: Scene,
	parent: TransformNode | null,
	radius: number,
	length: number,
	color: Color3,
	segments: number = CYLINDER_SEGMENTS): void {

	const buf = new GeometryBuffer();
	cylinder(buf, radius, length, segments);
	finish(scene, id(), buf, parent, color);
}

export function material(scene: Scene, name: string, color: Color3): StandardMaterial {
	const mat = new StandardMaterial(name + "-mat", scene);
	mat.diffuseColor = color;
	mat.specularColor = new Color3(0.2, 0.2, 0.2);
	return mat;
}

export function mesh(
	scene: Scene,
	name: string,
	buf: GeometryBuffer,
	parent: TransformNode | null,
	mat: Material): Mesh {

	const built = buf.toMesh(name, scene);
	if (!built) throw new Error(`${name}: no triangles emitted`);

	if (parent) built.parent = parent;
	built.material = mat;
	return built;
}

function finish(scene: Scene, name: string, buf: GeometryBuffer, parent: TransformNode | null, color: Color3): void {
	mesh(scene, name, buf, parent, material(scene, name, color));
}
