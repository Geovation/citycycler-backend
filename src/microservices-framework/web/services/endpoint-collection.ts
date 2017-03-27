/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as R from "ramda";

import { config } from "../../config";
import { IEndpoint } from "./api-endpoint";

export class EndpointCollection {
    private myEndpoints: IEndpoint[];
    private myEndpointCollections: EndpointCollection[];
    private myPrefix: string;

    constructor(prefix?: string) {
        this.myPrefix = prefix;
        this.myEndpoints = [];
        this.myEndpointCollections = [];
    }

    public addEndpoint(endpoint: IEndpoint): EndpointCollection {
        endpoint.setPathPrefix(this.myPrefix);
        this.myEndpoints.push(endpoint);
        return this;
    }

    public addEndpointCollection(endpointCollection: EndpointCollection): EndpointCollection {
        this.myEndpointCollections.push(endpointCollection);
        return this;
    }

    public endpoints(): IEndpoint[] {
        return this.myEndpoints;
    }

    public endpointCollections(): EndpointCollection[] {
        return this.myEndpointCollections;
    }

    public endpointPaths(): Object {
        return this.mergeProperties("path", "endpointPaths", {});
    }

    public endpointDefinitions(): Object {
        return this.mergeProperties("definitions", "endpointDefinitions", {});
    }

    public endpointSecurityDefinitions(): Object {
        return this.mergeProperties("securityDefinitions", "endpointSecurityDefinitions", {});
    }

    public endpointRoutes(): Object {
        return this.mergeProperties("route", "endpointRoutes", {});
    }

    public endpointServices(): any[] {
        return this.concatUniqueProperties("service", "endpointServices");
    }

    public endpointPins(): string[] {
        return this.concatUniqueProperties("pin", "endpointPins");
    }

    public senecaRoutes(): Object {
        const routes: Object[] = [];
        _.each(this.myEndpointCollections, coll => coll.senecaRoute(routes));
        return routes;
    }

    public prefix(): string {
        return this.myPrefix;
    }

    public toString(): string {
        return `EndpointCollection:
                    { endpoints: ${this.myEndpoints} },
                    { endpointCollections: ${this.myEndpointCollections} }`;
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

    private concatUniqueProperties(instanceMethod: string, collectionMethod: string): any[] {
        return _.reduce(
            this.endpointCollections(),
            (coll, endpointCollection) => {
                return _.compact(_.union(coll, endpointCollection[collectionMethod]()));
            },
            this.endpoints().map(endpoint => endpoint[instanceMethod]())
        );
    }
};
