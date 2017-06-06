/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as nPath from "path";
import * as qs from "qs";
import * as R from "ramda";
import * as logger from "winston";

import { APIEndpoint, IEndpoint } from "./api-endpoint";

const getParamName = param => Maybe
    .fromNullable(param.name)
    .map(name => name.toLowerCase())
    .getOrElse("");
const getParamNames = params => params.map(param => getParamName(param));
const parseQuery = query => qs.parse(query, { allowDots: true });
const extractPathParams = req => nPath.parse(req.url.split("?")[0]).name;
const extractParamsFromMessage = (parsedMsg, pNames) => _.pick(parsedMsg, pNames);
const addParamsToObject =
    (obj, paramDefinitions, paramsSource) =>
        Maybe.fromNullable(paramDefinitions)
            .map(params =>
                _.merge(
                    Maybe.fromNullable(obj)
                        .getOrElse({}),
                    extractParamsFromMessage(
                        paramsSource,
                        getParamNames(params))
                )
            );

export class MicroserviceEndpoint extends APIEndpoint {
    private myService: any;

    constructor(
        path: string,
    ) {
        super(path);
    }

    public pin() {
        let result;
        Maybe.fromNullable(this.myOperation)
            .orElse(() => result = Maybe.fromNullable(this.mySenecaOptions.role)
                .map(role => `role:${role}`)
                .getOrElse(`path:${this.mySenecaOptions.path}`));
        return result;
    }

    public route() {
        const path = this.mySenecaOptions.path;
        const route = _.set({}, path, { name: "" });
        const op = Maybe.fromNullable(this.myOperation).getOrElse({ path: "INVALID" });
        _.merge(route[path], _.set({}, _.keys(op)[0].toUpperCase(), true));
        Maybe.fromNullable(this.getPathParam())
            .map(param => _.set(route[path], "suffix", `/:${param.name.toLowerCase()}`));
        return route;
    }

    public plugin() {
        if (this.myOperation) {
            return options => {
                this.registerService(
                    options,
                    this.myService,
                    {
                        path: this.mySenecaOptions.path,
                        role: "api",
                    }
                );
            };
        } else {
            return null;
        }
    }

    public service() {
        return options => {
            this.registerService(options, this.myService, this.mySenecaOptions);
            return {
                name: this.mySenecaOptions.path,
                options: {},
            };
        };
    }

    public addService(service: Function): IEndpoint {
        const formatError = e => {
            const message = typeof e.message === "string" ? e.message : e;
            if (typeof message === "string" && message.indexOf(":") !== -1 &&
                !isNaN(parseInt(message.split(":")[0], 10))) {
                return {
                    ok: false,
                    result: {
                        error: message.split(":")[1],
                        status: parseInt(message.split(":")[0], 10),
                    },
                };
            } else {
                return { ok: false, result: { error: message, status: 500 } };
            }
        };
        this.myService = options => (msg, respond) => {
            try {
                service(this.broadcast, this.extractParams(msg))
                    .then(result => {
                        respond(null, { ok: true, result });
                        return result;
                    })
                    .catch(error => {
                        logger.error("service managed failure", error);
                        respond(null, formatError(error));
                    });
            } catch (e) {
                logger.error("service unmanaged failure", e);
                respond(null, formatError(e));
            }
        };
        return this;
    }

    private extractParams(message): any {
        try {
            const params = Maybe.fromNullable(message.params).getOrElse({});
            Maybe.fromNullable(message.request$)
                .map(req => {
                    Maybe.fromNullable(req.headers)
                        .map(headers => addParamsToObject(params, this.getHeaderParams(), headers));
                    // Maybe.fromNullable(req.headers)
                    //     .map(headers => addParamsToObject(params, this.getAuthParams(), headers));
                    Maybe.fromNullable(this.getPathParam())
                        .map(param => _.set(params, getParamName(param), extractPathParams(req)));
                });
            Maybe.fromNullable(message.args)
                .map(args => {
                    Maybe.fromNullable(args.body)
                        .map(body => _.merge(params, { body }));
                    Maybe.fromNullable(args.query)
                        .map(query => addParamsToObject(params, this.getQueryParams(), parseQuery(query)));
                });
            return params;
        } catch (e) {
            logger.error("parameter extraction unmanaged failure", e);
            return null;
        }
    }

    /**
     * Be aware that more than one microservice can match any given message pattern. In this case, the broadcast
     * will resolve when the first receiving microservice resolves (since we have no way of knowing what will
     * respond to any broadcast message).
     */
    private broadcastUsingSeneca(seneca, pattern, params) {
        return new Promise((resolve, reject) => {
            Maybe.fromNullable(seneca)
                .map(sen => {
                    sen.act({ params, path: pattern }, (err, res) => {
                        if (err) {
                            reject(err);
                        } else {
                            if (res.ok) {
                                resolve(res.result);
                            } else {
                                reject(res.result);
                            }
                        }
                    });
                })
                .orElse(() => {
                    resolve(params);
                });
        });
    }

    private registerService(options, service, params): IEndpoint {
        Maybe.fromNullable(options.seneca)
            .map(seneca => Maybe.fromNullable(service)
                .map(svc => seneca.add(params, svc(options)))
            );
        Maybe.fromNullable(options.senecaClient)
            .map(senClient => this.broadcast = R.partial(this.broadcastUsingSeneca, [senClient]));

        return this;
    }
}
