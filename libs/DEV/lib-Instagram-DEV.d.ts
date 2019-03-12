import Buster from "phantombuster"
import Nick from "nickjs"
import puppeteer from "puppeteer"

import { IUnknownObject } from "./lib-api-store"

import StoreUtilities from "./lib-StoreUtilities"

declare class Instagram {
	private utils: StoreUtilities
	private nick: Nick
	private buster: Buster

	constructor(nick: Nick, buster: Buster, utils: StoreUtilities)
	constructor(buster: Buster, utils: StoreUtilities)

	public login(tab: puppeteer.Page|Nick.Tab, cookie: string): Promise<void>
	public searchLocation(tab: Nick.Tab, searchTerm: string): Promise<string>
	public scrapePost(tab: Nick.Tab): Promise<IUnknownObject>
	public scrapePost2(tab: Nick.Tab, query: string): Promise<IUnknownObject>
	public scrapeProfile(tab: Nick.Tab, query: string, profileUrl: string): Promise<IUnknownObject>
	public cleanInstagramUrl(str: string): string|null
}

export = Instagram
