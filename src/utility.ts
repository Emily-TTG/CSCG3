import {
	UniqueIdGenerator
} from "@babylonjs/core";

export const SECOND = 1000;
export const TWO_PI = Math.PI * 2;

export function id(): string {
	return UniqueIdGenerator.UniqueId.toString();
}

export function asset(path: string): string {
	return import.meta.env.BASE_URL + path.replace(/^\//, "");
}
