import Nick from "nickjs"
import Buster from "phantombuster"

import { IUnknownObject, isUnknownObject } from "./lib-api-store"

declare class StoreUtilities {
	public ERROR_CODES: { [error in keyof typeof ERRORS]: number }
	public constructor(nick: Nick, buster: Buster)
	public constructor(buster: Buster)
	public log(message: unknown, type?: string): void
	public validateArguments(): IUnknownObject
	public isUrl(url: string): boolean
	public getRawCsv(url: string, printLogs?: boolean): Promise<IUnknownObject[]>
	public extractCsvRows(csv: IUnknownObject[], columnName?: string|string[], defaultColumn?: number): string[]|IUnknownObject[]
	public getDataFromCsv(url: string, columnName?: string|string[], printLogs?: boolean): Promise<string[]>
	public getDataFromCsv2(url: string, columnName?: string|string[], printLogs?: boolean): Promise<string[]>
	public checkTimeLeft(): Promise<{ timeLeft: boolean, message: string|number }>
	public getIP(): Promise<string>
	public saveResults(jsonResult: IUnknownObject[], csvResult: IUnknownObject[], name?: "result"|null|string , schema?: string[]|null, saveJson?: boolean): Promise<{ csvUrl: string, jsonUrl?: string }>
	public getDb(filename: string, parseContent?: boolean): Promise<IUnknownObject[]>
	public saveResult(result: IUnknownObject[], csvName?: "result"|null|string, schema?: string[]): Promise<void>
	public saveFlatResults(jsonResult: IUnknownObject[], csvResult: IUnknownObject[], name?: "result"|null|string): Promise<void>
	public checkArguments(args: IUnknownObject[]): IUnknownObject[]
	public adjustUrl(url: string, domain: string): string
	public checkDb(str: string, db: IUnknownObject[], property: string): boolean
	public filterRightOuter(left: IUnknownObject[], right: IUnknownObject[]): IUnknownObject[]
	public notifyByMail(): Promise<void>
	public saveImg(tab: Nick.Tab, imgUrl: string, fileName: string, errorMessage: string): Promise<string[]>
}

declare const enum ERRORS {
	EMPTY_SPREADSHEET = 71,
	CSV_NOT_PUBLIC = 72,
	GO_NOT_ACCESSIBLE = 75,
	BAD_INPUT = 76,
	PROXY_ERROR = 77,
	NO_INPUT = 78,
	LINKEDIN_BAD_COOKIE = 83,
	LINKEDIN_EXPIRED_COOKIE = 84,
	LINKEDIN_BLOCKED_ACCOUNT = 85,
	LINKEDIN_DEFAULT_COOKIE = 82,
	LINKEDIN_INVALID_COOKIE = 87,
	SLACK_DEFAULT_COOKIE = 88,
	SLACK_BAD_COOKIE = 89,
	SLACK_DEFAULT_WORKSPACE = 90,
	SLACK_BAD_WORKSPACE = 91,
	TWITTER_RATE_LIMIT = 92,
	TWITTER_BAD_COOKIE = 93,
	TWITTER_EXPIRED_COOKIE = 94,
	TWITTER_BLOCKED_ACCOUNT = 95,
	TWITTER_DEFAULT_COOKIE = 96,
	TWITTER_INVALID_COOKIE = 97,
	MEDIUM_DEFAULT_COOKIE = 98,
	MEDIUM_BAD_COOKIE = 99,
	PRODUCTHUNT_BAD_COOKIE = 100,
	PRODUCTHUNT_DEFAULT_COOKIE = 101,
	INSTAGRAM_BAD_COOKIE = 103,
	INSTAGRAM_EXPIRED_COOKIE = 104,
	INSTAGRAM_BLOCKED_ACCOUNT = 105,
	INSTAGRAM_DEFAULT_COOKIE = 106,
	INSTAGRAM_INVALID_COOKIE = 107,
	INTERCOM_BAD_COOKIE = 108,
	INTERCOM_DEFAULT_COOKIE = 109,
	FACEBOOK_BAD_COOKIE = 113,
	FACEBOOK_EXPIRED_COOKIE = 114,
	FACEBOOK_BLOCKED_ACCOUNT = 115,
	FACEBOOK_DEFAULT_COOKIE = 116,
	FACEBOOK_INVALID_COOKIE = 117,
	FACEBOOK_TIMEOUT = 118,
}

export = StoreUtilities
