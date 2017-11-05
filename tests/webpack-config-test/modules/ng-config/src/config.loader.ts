export abstract class ConfigLoader {
    abstract source(): string;
    abstract load(): Promise<{ [key: string]: any }>;
}
