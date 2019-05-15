import { Observable } from 'rxjs';

/**
 * A Path recognized by most methods in the DevKit.
 */
export type Path = string & {
    __PRIVATE_DEVKIT_PATH: void;
};

/**
 * A Path fragment (file or directory name) recognized by most methods in the DevKit.
 */
export type PathFragment = Path & {
    __PRIVATE_DEVKIT_PATH_FRAGMENT: void;
};

export type FileBuffer = ArrayBuffer;
export type FileBufferLike = ArrayBufferLike;

export interface HostWatchOptions {
    readonly persistent?: boolean;
    readonly recursive?: boolean;
}


// export const enum HostWatchEventType {
//     Changed = 0,
//     Created = 1,
//     Deleted = 2,
//     Renamed = 3,  // Applied to the original file path.
// }

export type Stats<T extends object = {}> = T & {
    readonly size: number;

    readonly atime: Date;
    readonly mtime: Date;
    readonly ctime: Date;
    readonly birthtime: Date;

    isFile(): boolean;
    isDirectory(): boolean;
};

export interface HostWatchEvent {
    // tslint:disable-next-line: no-reserved-keywords no-any
    readonly type: any; // HostWatchEventType

    readonly time: Date;
    readonly path: Path;
}

export interface HostCapabilities {
    synchronous: boolean;
}

export interface ReadonlyHost<StatsT extends object = {}> {
    readonly capabilities: HostCapabilities;

    read(path: Path): Observable<FileBuffer>;

    list(path: Path): Observable<PathFragment[]>;

    exists(path: Path): Observable<boolean>;
    isDirectory(path: Path): Observable<boolean>;
    isFile(path: Path): Observable<boolean>;

    // Some hosts may not support stats.
    stat(path: Path): Observable<Stats<StatsT> | null> | null;
}

export interface Host<StatsT extends object = {}> extends ReadonlyHost<StatsT> {
    write(path: Path, content: FileBufferLike): Observable<void>;
    delete(path: Path): Observable<void>;
    // tslint:disable-next-line: no-reserved-keywords
    rename(from: Path, to: Path): Observable<void>;

    // Some hosts may not support watching.
    watch(path: Path, options?: HostWatchOptions): Observable<HostWatchEvent> | null;
}
