import Nick from "nickjs"
import Buster from "phantombuster"

declare enum ERROR_CODES {
	EMPTY_SPREADSHEET = 71,
	CSV_NOT_PUBLIC = 72,
	GO_NOT_ACCESSIBLE = 75,
	BAD_INPUT = 76,
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
	INSTAGRAM_BAD_COOKIE = 103,
	INSTAGRAM_EXPIRED_COOKIE = 104,
	INSTAGRAM_BLOCKED_ACCOUNT = 105,
	INSTAGRAM_DEFAULT_COOKIE = 106,
	INSTAGRAM_INVALID_COOKIE = 107,
	FACEBOOK_BAD_COOKIE = 113,
	FACEBOOK_EXPIRED_COOKIE = 114,
	FACEBOOK_BLOCKED_ACCOUNT = 115,
	FACEBOOK_DEFAULT_COOKIE = 116,
	FACEBOOK_INVALID_COOKIE = 117,
	FACEBOOK_TIMEOUT = 118,
}

declare class StoreUtilities {
	public constructor(nick: Nick, buster: Buster)
	public ERROR_CODES: ERROR_CODES
	public log(message: string, type?: string): void
	public validateArguments(): object
	public isUrl(url: string): boolean
	public getRawCsv(url: string, printLogs?: boolean): Promise<Array<object>>
	public extractCsvRows(url: string, columnName?: string, printLogs?: boolean): Array<String>|Array<Object>
	public getDataFromCsv(url: string, columnName: string|Array<string>|undefined, printLogs?: boolean): Promise<Array<string>>
	public getDataFromCsv2(url: Array<string>, columnName: string|Array<string>|undefined, printLogs?: boolean): Promise<Array<string>>
	public checkTimeLeft(): Promise<{ timeLeft: boolean, message: string|number }>
	public getIP(): Promise<string>|Promise<void>
	public saveResults(jsonResult: Array<object>, csvResult: Array<object>, name?: "result" , schema?: Array<string>, saveJson?: boolean): Promise<void>
	public getDb(filename: string, parseContent?: boolean): Promise<Array<string>>|Promise<string>
	public saveResult(result: Array<object>, csvName?: "result", schema?: Array<string>): Promise<void>
	public checkArguments(args: Array<object>): Array<unknown>
	public adjustUrl(url: string, domain: string): string
	public checkDb(str: string, db: Array<object>, property: string): boolean
	public filterRightOuter(left: Array<object>, right: Array<object>): Array<object>
	public notifyByMail(): Promise<void>
}

export = StoreUtilities
