// updated version of @types/cache-manager as the original doesnt have promiseDependency

interface ICachingConfig {
    ttl: number;
}

interface IStoreConfig extends ICachingConfig {
    store: string;
    max?: number;
    isCacheableValue?: (value: any) => boolean;
    options: any;
    promiseDependency: any;
}

interface ICache {
    set<T>(key: string, value: T, options: ICachingConfig, callback?: (error: any) => void): void;
    set<T>(key: string, value: T, ttl: number, callback?: (error: any) => void): void;

    wrap<T>(key: string, wrapper: (callback: (error: any, result: T) => void) => void,
            options: ICachingConfig, callback: (error: any, result: T) => void): void;
    wrap<T>(key: string, wrapper: (callback: (error: any, result: T) => void) => void,
            callback: (error: any, result: T) => void): void;

    get<T>(key: string, callback: (error: any, result: T) => void): void;

    del(key: string, callback?: (error: any) => void): void;
}

interface ICacheManager {
    caching(IConfig: IStoreConfig): ICache;
    multiCaching(Caches: ICache[]): ICache;
}

declare let CacheManager: ICacheManager;

declare module "cache-manager" {
    export = CacheManager;
}
