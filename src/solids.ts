import { Vector3 } from "@babylonjs/core";

import type { GeometryBuffer } from "./geometry.js";

const ORIGIN = new Vector3(0, 0, 0);

const FACES: [Vector3, Vector3, Vector3][] = [
	[new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)],
	[new Vector3(-1, 0, 0), new Vector3(0, 0, 1), new Vector3(0, 1, 0)],
	[new Vector3(0, 1, 0), new Vector3(0, 0, 1), new Vector3(1, 0, 0)],
	[new Vector3(0, -1, 0), new Vector3(1, 0, 0), new Vector3(0, 0, 1)],
	[new Vector3(0, 0, 1), new Vector3(1, 0, 0), new Vector3(0, 1, 0)],
	[new Vector3(0, 0, -1), new Vector3(0, 1, 0), new Vector3(1, 0, 0)]
];

// Spread a grid coordinate t in [-1, 1] so that, once the cube is projected
// onto the sphere, the cells come out close to equal in area.
const warp = (t: number): number => Math.tan((t * Math.PI) / 4);

// Generate a spherified cube -- six n x n grids pushed out onto the sphere.
// This technique produces a relatively uniform vertex distribution which is
// also amenable to cubemap application (which Babylon natively supports).
//
// I learned of this technique and its benefits for this exact use-case from
// Sebastian Lague's video on procedural planet generation
// https://www.youtube.com/watch?v=lctXaT9pxA0 and a related video of his
// covering the application of world data to the resultant mesh
// https://www.youtube.com/watch?v=sLqXFF8mlEU (though he uses a custom
// sampler instead of a cubemap).
export function sphere(buf: GeometryBuffer, radius: number, n: number): void {
	for (const [out, u, v] of FACES) {
		// grid[i][j] is the index of the vertex at grid coordinate (i, j).
		// Shared edges between faces land on identical positions and normals,
		// so the buffer welds them automatically.
		const grid: number[][] = [];
		for (let i = 0; i <= n; i++) {
			grid[i] = [];
			for (let j = 0; j <= n; j++) {
				const a = warp(-1 + (2 * i) / n);
				const b = warp(-1 + (2 * j) / n);
				const direction = out.add(u.scale(a)).add(v.scale(b)).normalize();
				grid[i][j] = buf.vertex(direction.scale(radius), direction);
			}
		}

		for (let i = 0; i < n; i++) {
			for (let j = 0; j < n; j++) {
				// Round the cell the opposite way from u x v, which is the
				// inward-normal winding the rest of the project uses.
				buf.quad(grid[i][j], grid[i][j + 1], grid[i + 1][j + 1], grid[i + 1][j]);
			}
		}
	}
}

// Unit radial direction at segment i of n, around the z-axis.
function radial(i: number, n: number): Vector3 {
	const theta = (2 * Math.PI * i) / n;
	return new Vector3(Math.cos(theta), Math.sin(theta), 0);
}

export function cylinder(buf: GeometryBuffer, radius: number, height: number, nSegments: number): void {
	const up = new Vector3(0, 0, height);
	const capDown = new Vector3(0, 0, -1);
	const capUp = new Vector3(0, 0, 1);

	const bottomCentre = buf.vertex(ORIGIN, capDown);
	const topCentre = buf.vertex(ORIGIN.add(up), capUp);

	for (let i = 0; i < nSegments; i++) {
		const n1 = radial(i, nSegments);
		const n2 = radial(i + 1, nSegments);
		const b1 = n1.scale(radius);
		const b2 = n2.scale(radius);
		const t1 = b1.add(up);
		const t2 = b2.add(up);

		// Side panel.
		buf.quad(
			buf.vertex(b1, n1),
			buf.vertex(t1, n1),
			buf.vertex(t2, n2),
			buf.vertex(b2, n2)
		);

		// Bottom cap.
		buf.triangle(buf.vertex(b1, capDown), buf.vertex(b2, capDown), bottomCentre);

		// Top cap.
		buf.triangle(buf.vertex(t1, capUp), topCentre, buf.vertex(t2, capUp));
	}
}

export function annulus(buf: GeometryBuffer, inner: number, outer: number, nSegments: number): void {
	const up = new Vector3(0, 1, 0);
	const down = new Vector3(0, -1, 0);

	for (let i = 0; i < nSegments; i++) {
		const t1 = (2 * Math.PI * i) / nSegments;
		const t2 = (2 * Math.PI * (i + 1)) / nSegments;
		const d1 = new Vector3(Math.cos(t1), 0, Math.sin(t1));
		const d2 = new Vector3(Math.cos(t2), 0, Math.sin(t2));

		const a1 = d1.scale(inner);
		const a2 = d2.scale(inner);
		const b1 = d1.scale(outer);
		const b2 = d2.scale(outer);

		buf.quad(
			buf.vertex(a1, up), buf.vertex(b1, up),
			buf.vertex(b2, up), buf.vertex(a2, up)
		);

		buf.quad(
			buf.vertex(a1, down), buf.vertex(a2, down),
			buf.vertex(b2, down), buf.vertex(b1, down)
		);
	}
}
