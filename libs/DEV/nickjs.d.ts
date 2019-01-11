declare module "nickjs" {

	interface IOptions {
		debug?: boolean,
		headless?: boolean,
		loadImages?: boolean,
		httpProxy?: string,
		userAgent?: string,
		timeout?: number,
		width?: number,
		height?: number,
		printNavigation?: boolean,
		printPageErrors?: boolean,
		printResourceErrors?: boolean,
		printAborts?: boolean,
		whitelist?: Array<string | RegExp>,
		blacklist?: Array<string | RegExp>,
	}

	interface ICookie {
		name: string,
		value: string,
		domain?: string,
	}

	interface IScreenshot {
		quality?: number,
		fullPage?: boolean,
	}

	interface IFill {
		submit?: boolean,
	}

	// interface ISendKeys {
	// }

	type selectors = string[] | string

	class Tab {
		public open(url: string): Promise<[number, string]>
		public waitUntilVisible(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
		public waitWhileVisible(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
		public waitUntilPresent(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
		public waitWhilePresent(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
		public click(selector: string): Promise<void>
		public screenshot(filename: string, options?: IScreenshot): Promise<string>
		public inject(urlOrPath: string): Promise<void>
		public fill(selector: string, inputs: {[name: string]: string | boolean | number}, options?: IFill): Promise<void>
	}

	class Nick {
		constructor(options?: IOptions)
		public exit(code?: number): void
		public setCookie(cookie: ICookie): Promise<void>
		public deleteCookie(cookieName: string, cookieDomain: string): Promise<void>
		public deleteAllCookies(): Promise<void>
		public getAllCookies(): Promise<Array<unknown>>
		public newTab(): Promise<Tab>
	}

	export = Nick

}
