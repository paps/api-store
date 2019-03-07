import * as Puppeteer from "puppeteer"
import Nick from "nickjs"
import Buster from "phantombuster"
import StoreUtilities from "./lib-StoreUtilities"

declare class Medium {

	private nick: Nick
	private buster: Buster
	private utils: StoreUtilities

	public constructor(nick: Nick, buster: Buster, utils: StoreUtilities)
	public constructor(buster: Buster, utils: StoreUtilities)
	public login(tab: Nick.Tab|Puppeteer.Page, uid: string, sid: string): Promise<void>
	public getClapsCount(tab: Nick.Tab|Puppeteer.Page, closePopup?: boolean, verbose?: boolean): Promise<number>
}

declare function isUsingNick(tab: Nick.Tab|Puppeteer.Page): boolean

export = Medium
