import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject, isUnknownObject } from "./lib-api-store"

declare class Messaging {
	private utils: StoreUtilities
	constructor(utils: StoreUtilities)
	public getMessageTags(message: string): string[]
	public forgeMessage(message: string, tags: IUnknownObject|null, firstName?: string|IUnknownObject|null): string
}

export = Messaging
