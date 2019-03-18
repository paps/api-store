import "puppeteer"

declare module "puppeteer" {
	// @ts-ignore
	class FrameBase {
		// tslint:disable-next-line:no-any
		public evaluate(fn: EvaluateFn, ...args: any[]): Promise<unknown>
	}
}

export interface IUnknownObject {[index: string]: unknown}

export type IEvalAny = any // tslint:disable-line:no-any

export function isUnknownObject(obj: unknown): obj is IUnknownObject {
	return typeof obj === "object" && obj !== null
}
