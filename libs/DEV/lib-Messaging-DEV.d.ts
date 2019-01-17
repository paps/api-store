import StoreUtilities from "./lib-StoreUtilities-DEV"
import { IUnknownObject, isUnknownObject } from "./lib-api-store-DEV"

declare class Messaging {
	private utils: StoreUtilities
	constructor(utils: StoreUtilities)
	public getMessagesTags(message: string): string[]
	public forgeMessage(message: string, tags: IUnknownObject|null, firstName?: string|IUnknownObject|null): string
}

export = Messaging
