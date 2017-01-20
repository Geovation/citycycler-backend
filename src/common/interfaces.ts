import * as joi from "joi";
import * as koa from "koa";

export interface ISwaggerEndpoint {
    definitions: Object;
    delete?: koa.Middleware;
    endpoint?: string;
    get?: koa.Middleware;
    paths: Object;
    routes?: Object;
    post?: koa.Middleware;
    put?: koa.Middleware;
};

export interface IConfigurationComposite {
    common?: any;
    logger?: any;
    server?: any;
};

export interface IValidationOptions {
    value: any;
    schema: joi.Schema;
    errorMessage: string;
    errorStatus: number;
};

export interface IValidationError {
    status: number;
    ok: boolean;
    err: Error;
};

export interface IValidationFormatOptions {
    err: any;
    message: string;
    status: number;
    value: any;
};

export interface IKeyedCollection<T> {
    add(key: string, value: T);
    containsKey(key: string): boolean;
    count(): number;
    item(key: string): T;
    keys(): string[];
    remove(key: string): T;
    values(): T[];
};
