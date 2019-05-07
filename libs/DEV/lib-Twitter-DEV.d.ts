import * as Puppeteer from "puppeteer"
import Nick from "nickjs"
import Buster from "phantombuster"
import StoreUtilities from "./lib-StoreUtilities"
import { IUnknownObject } from "./lib-api-store"

declare class Twitter {
	private nick: Nick
	private buster: Buster
	private utils: StoreUtilities

	public constructor(nick: Nick, buster: Buster, utils: StoreUtilities)
	public constructor(buster: Buster, utils: StoreUtilities)
	public isLogged(tab: Nick.Tab|Puppeteer.Page, printErrors?: boolean): Promise<boolean>
	public login(tab: Nick.Tab|Puppeteer.Page, cookie: string, betaOptIn?: boolean): Promise<void>
	public isBetaOptIn(tab: Nick.Tab|Puppeteer.Page): Promise<boolean>
	public openProfile(tab: Nick.Tab|Puppeteer.Page, url: string): Promise<void>
	public scrapeProfile(tab: Nick.Tab|Puppeteer.Page, url: string, verbose?: boolean): Promise<IUnknownObject>
	public collectFollowers(tab: Nick.Tab, url: string, limit?: number, isNetworkCleaner?: boolean): Promise<IUnknownObject[]>
	public checkEmail(tab: Nick.Tab, input: string): Promise<string>
	public matchEmail(email1: string, email2: string): string
	public loadList(tab: Nick.Tab|Puppeteer.Page, count?: number, verbose?: boolean): Promise<number>
}

export = Twitter
