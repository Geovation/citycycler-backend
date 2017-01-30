/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as R from "ramda";

import { config } from "../../config";
import { APIEndpoint } from "./api-endpoint";

export class APIEndpointCollection {
    private myApiEndpoints: APIEndpoint[];
    private myApiEndpointCollections: APIEndpointCollection[];
    private myPrefix: string;

    constructor(prefix?: string) {
        this.myPrefix = prefix;
        this.myApiEndpoints = [];
        this.myApiEndpointCollections = [];
    }

    public addApiEndpoint(endpoint: APIEndpoint): APIEndpointCollection {
        endpoint.setPathPrefix(this.myPrefix);
        this.myApiEndpoints.push(endpoint);
        return this;
    }

    public addApiEndpointCollection(endpointCollection: APIEndpointCollection): APIEndpointCollection {
        this.myApiEndpointCollections.push(endpointCollection);
        return this;
    }

    public endpoints(): APIEndpoint[] {
        return this.myApiEndpoints;
    }

    public endpointCollections(): APIEndpointCollection[] {
        return this.myApiEndpointCollections;
    }

    public endpointPaths(): Object {
        return this.mergeProperties("path", "endpointPaths", {});
    }

    public endpointDefinitions(): Object {
        return this.mergeProperties("definitions", "endpointDefinitions", {});
    }

    public endpointRoutes(): Object {
        return this.mergeProperties("route", "endpointRoutes", {});
    }

    public senecaRoutes(): Object {
        const routes: Object[] = [];
        _.each(this.myApiEndpointCollections, coll => coll.senecaRoute(routes));
        return routes;
    }

    public endpointPins(): string[] {
        return _.reduce(
            this.endpointCollections(),
            (coll, endpointCollection) => {
                return _.union(coll, endpointCollection.endpointPins());
            },
            this.endpoints().map(endpoint => endpoint.pin())
        );
    }

    public prefix(): string {
        return this.myPrefix;
    }

    public toString(): string {
        return `APIEndpointCollection:
                    { endpoints: ${this.myApiEndpoints} },
                    { endpointCollections: ${this.myApiEndpointCollections} }`;
    }

    protected senecaRoute(routes = []): Object[] {
        const joinStrings = R.curry((char, s1, s2) => [s1, s2].join(char));
        const joinConfigPrefix = joinStrings("/", config.server.prefix);
        const addToRoutes = prefix => routes.push({
                map: this.endpointRoutes(),
                pin: "role:api,path:*",
                prefix: joinConfigPrefix(prefix),
            });
        Maybe.fromNullable(this.myPrefix).map(addToRoutes);
        return routes;
    }

    private mergeProperties(instanceMethod: string, collectionMethod: string, value: Object) {
        const mergeResults = R.curry((method, coll) => _.each(coll, item => _.merge(value, item[method]())));
        Maybe.fromNullable(this.endpoints()).map(mergeResults(instanceMethod));
        Maybe.fromNullable(this.endpointCollections()).map(mergeResults(collectionMethod));
        return value;
    }
};
