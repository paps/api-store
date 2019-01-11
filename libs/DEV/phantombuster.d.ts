declare module "phantombuster" {

	class Buster {
		public download(url: string, saveAs?: string, headers?: {[name: string]: string}): Promise<string>
		public save(url: string, saveAs?: string, headers?: {[name: string]: string}): Promise<string>
		public saveFolder(localFolder?: string, storageFolder?: string): Promise<string>
		public saveText(text: string, saveAs: string, mime?: string): Promise<string>
		public saveBase64(text: string, saveAs: string, mime?: string): Promise<string>
		public solveCaptcha(selector: string): Promise<string>
		public solveCaptchaBase64(base64: string): Promise<string>
		public solveNoCaptcha(url: string, key: string, secret?: string): Promise<string>
		public solveCaptchaImage(url: string, headers?: {[name: string]: string}): Promise<string>
		public mail(subject: string, text: string, to?: string): Promise<void>
		public pushover(message: string, options?: object): Promise<void>
		public progressHint(progress: number, label?: string): void
		public overrideTimeLimit(seconds: number): Promise<void>
		public getTimeLeft(): Promise<number>
		public setAgentObject(agentId: number, object: object): Promise<void>
		public getAgentObject(agentId: number): Promise<unknown>
		public setGlobalObject(object: object): Promise<void>
		public getGlobalObject(): Promise<unknown>
		public setResultObject(object: object): Promise<void>
	}

	export = Buster

}
