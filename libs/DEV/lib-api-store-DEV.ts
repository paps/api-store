import "puppeteer"

declare module "puppeteer" {
	class FrameBase {
		// tslint:disable-next-line no-any
		public evaluate(fn: EvaluateFn, ...args: any[]): Promise<unknown>
	}
}

export interface IUnknownObject {[index: string]: unknown}

export function isUnknownObject(obj: unknown): obj is IUnknownObject {
	return typeof obj === "object" && obj !== null
}
