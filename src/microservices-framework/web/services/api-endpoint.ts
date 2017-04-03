/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as R from "ramda";
import * as logger from "winston";

import { functions as F } from "../../common/utilities";
import { getSwaggerJson } from "../swagger";

export class APIEndpoint {
    public broadcast: Function;
    protected myOperation: Object;
    protected myDefinitions: Object;
    protected mySecurityDefinitions: Object;
    protected mySenecaOptions: any;
    protected myPrefix: string;
    protected getCachedParamsFromSwaggerJSON: Function = R.memoize(this.getParamsFromSwaggerJSON);

    constructor(
        path: string,
    ) {
        this.mySenecaOptions = { path };
    }

    // SWAGGER SPEC

    /**
     *    This is a swagger operation object (see http://swagger.io/specification/#operationObject)
     */
    public addSwaggerOperation(path: Object): IEndpoint {
        // validate method... && path??
        this.myOperation = path;
        return this;
    }

    public setPathPrefix(prefix: string): IEndpoint {
        const suffix =
            Maybe.fromNullable(this.getPathParam())
                .map(param => param.name)
                .getOrElse(undefined);
        const pathSuffix =
            Maybe.fromNullable(suffix)
                .map(suff => `/{${suff}}`)
                .getOrElse("");
        this.myPrefix = F.concat(`/${prefix}`, pathSuffix);
        return this;
    }

    public path(): Object {
        return Maybe.fromNullable(this.myPrefix)
            .map(prefix => _.set({}, prefix, this.myOperation))
            .getOrElse(this.myOperation);
    }

    public addSwaggerDefinitions(definitions): IEndpoint {
        this.myDefinitions = definitions;
        return this;
    }

    public addSwaggerSecurityDefinitions(securityDefinitions): IEndpoint {
        this.mySecurityDefinitions = securityDefinitions;
        logger.warn("This security definition can only be referenced by this endpoint. " +
            "To add a securityDefinition globally you need to add it to " +
            "/src/microservices-framework/web/swagger/index.ts");
        return this;
    }

    public definitions(): Object {
        return this.myDefinitions;
    }

    public securityDefinitions(): Object {
        return this.mySecurityDefinitions;
    }

    // END SWAGGER SPEC

    // SENECA SPEC

    public pin() {
        return undefined;
    }

    public route() {
        return undefined;
    }

    public plugin() {
        return undefined;
    }

    public service() {
        return undefined;
    }

    public addService(service: (broadcast: Function, params: any) => Promise<any>): IEndpoint {
        return this;
    }

    public addBefore(operation): IEndpoint {
        return this;
    }

    public addAfter(operation): IEndpoint {
        return this;
    }

    // END SENECA SPEC

    protected getParameters(path: any, result = []) {
        _.each(path, (val, key) => {
            if (key === "parameters") {
                _.each(val, param => result.push(param));
            } else if (key === "security") {
                // Olly's Addition
                // add each type of security definition parameter to the params
                _.each(val, securityObj => {
                    const securityType = Object.keys(securityObj)[0];
                    try {
                        // Try to find this securityDefinition locally (on this endpoint)
                        result.push(this.mySecurityDefinitions[securityType]);
                    } catch (err) {
                        // Try to find this securityDefinition in the root
                        try {
                            let swaggerJson = getSwaggerJson();
                            result.push(swaggerJson.securityDefinitions[securityType]);
                        } catch (err) {
                            logger.error("Couldn't add securty definition " + securityType);
                        }
                    }
                });
            } else if (_.isObject(val)) {
                this.getParameters(val, result);
            }
        });
        return result;
    }

    protected getParamsFromSwaggerJSON(location) {
        return _.filter(
            this.getParameters(this.myOperation),
            param => {
                return Maybe.fromNullable(param.in)
                    .map(loc => loc === location)
                    .getOrElse(false);
            }
        );
    }

    protected getPathParam() {
        return this.getCachedParamsFromSwaggerJSON("path")[0];
    }

    protected getQueryParams() {
        return this.getCachedParamsFromSwaggerJSON("query");
    }

    protected getHeaderParams() {
        return this.getCachedParamsFromSwaggerJSON("header");
    }
};

export interface IEndpoint extends APIEndpoint { };
