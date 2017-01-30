/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as nPath from "path";

import { functions as F } from "../../common/utilities";

export class APIEndpoint {
    private myPath: Object;
    private myDefinitions: Object;
    private mySenecaOptions: any;
    private myPrefix: string;

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

            seneca.add({
                    path: opts.path,
                    role: "api",
                }, (msg, respond) => {
                    try {
                        const senecaParams = {
                            $fatal: false,
                            cmd: opts.cmd,
                            path: opts.path,
                            role: opts.role,
                        };
                        Maybe.fromNullable(this.getPathParam())
                            .map(param => senecaParams[param.name.toLowerCase()] =
                                    nPath.parse(msg.request$.url.split("?")[0]).name);
                        seneca.act(senecaParams, respond);
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

    private getPathParam () {
        return _.find(
                this.getParameters(this.myPath), param => {
                    return Maybe.fromNullable(param.in)
                        .map(loc => loc === "path")
                        .getOrElse(false);
                }
            );
    }
};
