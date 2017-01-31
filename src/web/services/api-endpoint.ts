/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as nPath from "path";
import * as qs from "qs";
import * as R from "ramda";

import { functions as F } from "../../common/utilities";

export class APIEndpoint {
    private myPath: Object;
    private myDefinitions: Object;
    private mySenecaOptions: any;
    private myPrefix: string;
    private getCachedParamsFromSwaggerJSON: Function = R.memoize(this.getParamsFromSwaggerJSON);

    constructor(
        senecaOptions: any,
    ) {
        this.mySenecaOptions = senecaOptions;
    }

    public addPath(path: Object): APIEndpoint {
        // validate method... && path??
        this.myPath = path;
        return this;
    }

    public setPathPrefix(prefix: string): APIEndpoint {
        const suffix = this.route()[this.mySenecaOptions.path].suffix;
        const pathSuffix =
            Maybe.fromNullable(suffix)
                .map(suff => `/\{${suff.split(":")[1]}\}`)
                .getOrElse("");
        this.myPrefix = F.concat(`/${prefix}`, pathSuffix);
        return this;
    }

    public path(): Object {
        return Maybe.fromNullable(this.myPrefix)
                .map(prefix => _.set({}, prefix, this.myPath))
                .getOrElse(this.myPath);
    }

    public addDefinitions(definitions): APIEndpoint {
        this.myDefinitions = definitions;
        return this;
    }

    public definitions(): Object {
        return this.myDefinitions;
    }

    public pin() {
        return `role:${this.mySenecaOptions.role}`;
    }

    public route () {
        const path = this.mySenecaOptions.path;
        const route = _.set({}, path, { name: "" });
        _.merge(route[path], _.set({}, _.keys(this.myPath)[0].toUpperCase(), true));
        Maybe.fromNullable(this.getPathParam())
            .map(param => _.set(route[path], "suffix", `/:${param.name.toLowerCase()}`));
        return route;
    }

    public plugin () {
        return options => {
            const seneca = options.seneca;
            const opts = this.mySenecaOptions;

            const getParamName = param => Maybe.fromNullable(param.name).map(name => name.toLowerCase()).getOrElse("");
            const getParamNames = params => params.map(param => getParamName(param));
            const parseQuery = query => qs.parse(query, { allowDots: true });
            const extractPathParams = msg => nPath.parse(msg.request$.url.split("?")[0]).name;
            const extractParams = (parsedMsg, pNames) => _.pick(parsedMsg, pNames);
            const addParamsToObject = (obj, paramDefinitions, paramsSource) => Maybe.fromNullable(paramDefinitions)
                    .map(params => _.merge(
                        Maybe.fromNullable(obj.params).getOrElse(_.set(obj, params, {})),
                        extractParams(paramsSource, getParamNames(params))));

            seneca.add({
                    path: opts.path,
                    role: "api",
                }, (msg, respond) => {
                    try {
                        const payload = {
                            $fatal: false,
                            cmd: opts.cmd,
                            params: {},
                            path: opts.path,
                            role: opts.role,
                        };
                        // add path parameters
                        Maybe.fromNullable(this.getPathParam())
                            .map(param => _.set(payload.params, getParamName(param), extractPathParams(msg)));
                        // add query string parameters
                        addParamsToObject(payload, this.getQueryParams(), parseQuery(msg.args.query));
                        // add header parameters
                        addParamsToObject(payload, this.getHeaderParams(), msg.request$.header);
                        seneca.act(payload, respond);
                    } catch (err) {
                        return respond(null, err);
                    }
                },
            );
        };
    }

    private getParameters (path: any, result = []) {
        _.each(path, (val, key) => {
            if (key === "parameters") {
                _.each(val, param => result.push(param));
            } else if (_.isObject(val)) {
                this.getParameters(val, result);
            }
        });
        return result;
    }

    private getParamsFromSwaggerJSON (location) {
        return _.filter(
            this.getParameters(this.myPath),
            param => {
                return Maybe.fromNullable(param.in)
                    .map(loc => loc === location)
                    .getOrElse(false);
            }
        );
    }

    private getPathParam () {
        return this.getCachedParamsFromSwaggerJSON("path")[0];
    }

    private getQueryParams () {
        return this.getCachedParamsFromSwaggerJSON("query");
    }

    private getHeaderParams () {
        return this.getCachedParamsFromSwaggerJSON("header");
    }
};
