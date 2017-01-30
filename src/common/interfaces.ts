/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as joi from "joi";
// import * as koa from "koa";

export interface ISwaggerEndpoint {
    apiEndpoints: Object;
    definitions: Object;
    paths: Object;
    routes: Object;
    tag: string;
};

export interface IConfigurationComposite {
    common?: any;
    logger?: any;
    server?: any;
    services?: any;
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
