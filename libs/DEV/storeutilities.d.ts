import Nick from "nickjs"
import Buster from "phantombuster"

declare module "storeutilities" {

	class StoreUtilities {
		public ERROR_CODES: object
		public constructor(nick: Nick, buster: Buster)
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

}
