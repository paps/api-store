declare module "storeutilities" {

	class StoreUtilities {
		public log(message: string, type?: string): void
		public validateArguments(): object
		public isUrl(url: string): boolean
		public getRawCsv(url: string, printLogs?: boolean): Promise<Array<object>>
		public extractCsvRows(url: string, columnName?: string, printLogs?: boolean): Array<String>|Array<Object>
		public getDataFromCsv2(url: Array<Object>, columnName: string|Array<string>): Promise<Array<string>>

	}

	export = StoreUtilities

}
