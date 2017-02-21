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

export class MicroserviceEndpoint extends APIEndpoint {
    private myService: any;

    constructor(
        path: string,
    ) {
        super(path);
    }

    public pin () {
        return Maybe.fromNullable(this.mySenecaOptions.role)
                .map(role => `role:${role}`)
                .getOrElse(`path:${this.mySenecaOptions.path}`);
    }

    public route () {
        const path = this.mySenecaOptions.path;
        const route = _.set({}, path, { name: "" });
        const op = Maybe.fromNullable(this.myOperation).getOrElse({ path: "INVALID" });
        _.merge(route[path], _.set({}, _.keys(op)[0].toUpperCase(), true));
        Maybe.fromNullable(this.getPathParam())
            .map(param => _.set(route[path], "suffix", `/:${param.name.toLowerCase()}`));
        return route;
    }

    public plugin () {
        if (this.myOperation) {
            return options => {
                const senOpts = this.mySenecaOptions;

                const getParamName = param => Maybe
                                                .fromNullable(param.name)
                                                .map(name => name.toLowerCase())
                                                .getOrElse("");
                const getParamNames = params => params.map(param => getParamName(param));
                const parseQuery = query => qs.parse(query, { allowDots: true });
                const extractPathParams = msg => nPath.parse(msg.request$.url.split("?")[0]).name;
                const extractParamsFromMessage = (parsedMsg, pNames) => _.pick(parsedMsg, pNames);
                const addParamsToObject =
                    (obj, paramDefinitions, paramsSource) =>
                        Maybe.fromNullable(paramDefinitions)
                            .map(params =>
                                    _.merge(
                                        Maybe.fromNullable(obj.params)
                                            .getOrElse(_.set(obj, params, {})),
                                        extractParamsFromMessage(
                                            paramsSource,
                                            getParamNames(params))
                                    )
                                );

                const service = opts => (msg, respond) => {
                    const seneca = Maybe.fromNullable(opts.seneca);
                    try {
                        const payload = _.merge(
                            senOpts,
                            {
                                default$: `No service matching message ${senOpts}`,
                                fatal$: false,
                                params: {},
                            }
                        );
                        Maybe.fromNullable(this.getPathParam())
                            .map(param => _.set(payload.params, getParamName(param), extractPathParams(msg)));
                        addParamsToObject(payload, this.getQueryParams(), parseQuery(msg.args.query));
                        addParamsToObject(payload, this.getHeaderParams(), msg.request$.header);
                        Maybe.fromNullable(msg.args.body).map(body => {
                            _.merge(payload.params, { body });
                        });
                        seneca.map(sen => {
                            sen.act(payload, respond);
                        });
                    } catch (err) {
                        return respond(null, err);
                    }
                };
                this.registerService(
                    options,
                    service,
                    {
                        path: Maybe.fromNullable(senOpts.path).getOrElse(""),
                        role: "api",
                    }
                );
            };
        } else {
            return null;
        }
    }

    public service () {
        return options => {
            this.registerService(options, this.myService, this.mySenecaOptions);
            return {
                name: this.mySenecaOptions.path,
                options: {},
            };
        };
    }

    public addService (service: Function): IEndpoint {
        this.myService = options => (msg, respond) => {
            try {
                service(this.broadcast, msg.params)
                .then(result => {
                    respond(null, { ok: true, result });
                    return result;
                })
                .catch(error => {
                    respond(null, { ok: false, result: { err: error, message: error.message, status: 500 } });
                });
            } catch (e) {
                logger.error("service failed", e);
                respond(null, { ok: false, result: e.message } );
            }
        };
        return this;
    }

    /**
     * Be aware that more than one microservice can match any given message pattern. In this case, the broadcast
     * will resolve when the first receiving microservice resolves (since we have no way of knowing what will
     * respond to any broadcast message).
     */
    private broadcastUsingSeneca (seneca, pattern, params) {
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

    private registerService (options, service, params): IEndpoint {
        Maybe.fromNullable(options.seneca)
            .map(seneca => Maybe.fromNullable(service)
                .map(svc => seneca.add(params, svc(options)))
            );
        Maybe.fromNullable(options.senecaClient)
            .map(senClient => this.broadcast = R.partial(this.broadcastUsingSeneca, [senClient]));

        return this;
    }
}
