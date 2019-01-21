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

	interface ISendKeys {
		keepFocus?: boolean,
		reset?: boolean,
		modifiers?: boolean,
	}

	type selectors = string[] | string

	class Nick {

		public readonly options: IOptions
		public readonly tabs: Nick.Tab[]
		public readonly driver: unknown // maybe change this?
		public readonly browserDriver: unknown // maybe change this?

		constructor(options?: IOptions)
		public exit(code?: number): void
		public setCookie(cookie: ICookie): Promise<void>
		public deleteCookie(cookieName: string, cookieDomain: string): Promise<void>
		public deleteAllCookies(): Promise<void>
		public getAllCookies(): Promise<Array<unknown>> // maybe type what is a cookie?
		public newTab(): Promise<Nick.Tab>

	}

	namespace Nick {

		interface Tab { // tslint:disable-line:interface-name

			readonly nick: Nick
			readonly actionInProgress: boolean
			readonly closed: boolean
			readonly crashed: boolean
			readonly id: number

			readonly driver: unknown // maybe change this?
			readonly tabDriver: unknown // maybe change this?

			onPrompt: (message: string) => string
			onConfirm: (message: string) => boolean

			wait(duration: number): Promise<void>
			waitUntilVisible(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			waitUntilVisible(selectors: selectors, condition?: "and" | "or", timeout?: number): Promise<string>
			waitWhileVisible(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			waitWhileVisible(selectors: selectors, condition?: "and" | "or", timeout?: number): Promise<string>
			waitUntilPresent(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			waitUntilPresent(selectors: selectors, condition?: "and" | "or", timeout?: number): Promise<string>
			waitWhilePresent(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			waitWhilePresent(selectors: selectors, condition?: "and" | "or", timeout?: number): Promise<string>
			untilVisible(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			whileVisible(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			untilPresent(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			whilePresent(selectors: selectors, timeout?: number, condition?: "and" | "or"): Promise<string>
			isPresent(selectors: selectors, condition?: "and" | "or"): Promise<string>
			isVisible(selectors: selectors, condition?: "and" | "or"): Promise<string>

			getUrl(): Promise<string>
			getContent(): Promise<string>

			open(url: string): Promise<[number, string, string]>
			close(): Promise<void>
			evaluate(func: (arg: object, callback: (err: string, res: unknown) => void) => void, arg: object): Promise<unknown>
			click(selector: string): Promise<void>
			screenshot(filename: string, options?: IScreenshot): Promise<string>
			inject(urlOrPath: string): Promise<void>
			fill(selector: string, inputs: {[name: string]: string | boolean | number}, options?: IFill): Promise<void>
			sendKeys(selector: string, keys: string, options: ISendKeys): Promise<void>
			scrollTo(x: number, y: number): Promise<void>
			scroll(x: number, y: number): Promise<void>
			scrollToBottom(): Promise<void>

		}

	}

	export = Nick

}
