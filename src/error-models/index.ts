// tslint:disable:no-any
// tslint:disable:no-unsafe-any
// tslint:disable:max-classes-per-file

export class InternalError extends Error {
    private _nativeError: Error;

    constructor(message: string) {
        super(message);
        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        (Object as any).setPrototypeOf(this, InternalError.prototype);

        const nativeError = new Error(message) as any as Error;
        nativeError.name = 'InternalError';
        this._nativeError = nativeError;
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): any {
        return (this._nativeError as any).stack;
    }
    set stack(value: any) {
        if (this._nativeError) {
            (this._nativeError as any).stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}

export class InvalidConfigError extends Error {
    private readonly _nativeError: Error;

    constructor(message: string) {
        super(message);

        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        (Object as any).setPrototypeOf(this, InvalidConfigError.prototype);

        const nativeError = new Error(message) as any as Error;
        nativeError.name = 'InvalidConfigError';
        this._nativeError = nativeError;
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): any {
        return (this._nativeError as any).stack;
    }
    set stack(value: any) {
        if (this._nativeError) {
            (this._nativeError as any).stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}

export class InvalidOptionError extends Error {
    private _nativeError: Error;

    constructor(message: string) {
        super(message);
        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        (Object as any).setPrototypeOf(this, InvalidOptionError.prototype);

        const nativeError = new Error(message) as any as Error;
        nativeError.name = 'InvalidOptionError';
        this._nativeError = nativeError;
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): any {
        return (this._nativeError as any).stack;
    }
    set stack(value: any) {
        if (this._nativeError) {
            (this._nativeError as any).stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}

export class TypescriptCompileError extends Error {
    private _nativeError: Error;

    constructor(message: string) {
        super(message);
        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        (Object as any).setPrototypeOf(this, TypescriptCompileError.prototype);

        const nativeError = new Error((message as any).message || message) as any as Error;
        nativeError.name = 'TypescriptCompileError';
        this._nativeError = nativeError;

        if ((message as any).message && (message as any).stack) {
            this.stack = (message as any).stack;
        }
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): any {
        return (this._nativeError as any).stack;
    }
    set stack(value: any) {
        if (this._nativeError) {
            (this._nativeError as any).stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}

export class UglifyError extends Error {
    private _nativeError: Error;

    constructor(message: string) {
        super(message);
        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        (Object as any).setPrototypeOf(this, UglifyError.prototype);

        const nativeError = new Error(message) as any as Error;
        nativeError.name = 'UglifyError';
        this._nativeError = nativeError;
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): any {
        return (this._nativeError as any).stack;
    }
    set stack(value: any) {
        if (this._nativeError) {
            (this._nativeError as any).stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}

export class UnSupportedStyleExtError extends Error {
    private _nativeError: Error;

    constructor(message: string) {
        super(message);
        // Required for TS 2.1, see
        // https://github.com/Microsoft/TypeScript/wiki/Breaking-Changes#extending-built-ins-like-error-array-and-map-may-no-longer-work
        (Object as any).setPrototypeOf(this, UnSupportedStyleExtError.prototype);

        const nativeError = new Error(message) as any as Error;
        nativeError.name = 'UnSupportedStyleExtError';
        this._nativeError = nativeError;
    }

    get message(): string {
        return this._nativeError.message;
    }
    set message(message: string) {
        if (this._nativeError) {
            this._nativeError.message = message;
        }
    }
    get name(): string {
        return this._nativeError.name;
    }
    set name(name: string) {
        if (this._nativeError) {
            this._nativeError.name = name;
        }
    }
    get stack(): any {
        return (this._nativeError as any).stack;
    }
    set stack(value: any) {
        if (this._nativeError) {
            (this._nativeError as any).stack = value;
        }
    }
    toString(): string {
        return this._nativeError.toString();
    }
}
