declare module 'opossum' {
	interface Options {
		timeout?: number;
		errorThresholdPercentage?: number;
		resetTimeout?: number;
		rollingCountTimeout?: number;
		rollingCountBuckets?: number;
		capacity?: number;
		[key: string]: any;
	}

	interface CircuitBreaker<T extends (...args: any[]) => any> {
		fire: (...args: Parameters<T>) => Promise<ReturnType<T>>;
		fallback: (fn: (...args: any[]) => any) => void;
		on: (event: string, listener: (...args: any[]) => void) => void;
		open: () => void;
		close: () => void;
		shutdown: () => void;
		status: () => { open: boolean; };
		// allow any additional properties
		[key: string]: any;
	}

	// opossum can be used with or without `new` in some codebases; provide both signatures
	type OpossumFactory = {
		<T extends (...args: any[]) => any>(action: T, options?: Options): CircuitBreaker<T>;
		new <T extends (...args: any[]) => any>(action: T, options?: Options): CircuitBreaker<T>;
	};

	const opossum: OpossumFactory;
	export default opossum;
}
