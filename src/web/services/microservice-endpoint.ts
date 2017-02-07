/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as Maybe from "data.maybe";
import * as _ from "lodash";
import * as nPath from "path";
import * as qs from "qs";

import { APIEndpoint, IEndpoint } from "./api-endpoint";

export class MicroserviceEndpoint extends APIEndpoint {
    private myService: any;
    private myBefore: any;
    private myAfter: any;

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
        _.merge(route[path], _.set({}, _.keys(this.myOperation)[0].toUpperCase(), true));
        Maybe.fromNullable(this.getPathParam())
            .map(param => _.set(route[path], "suffix", `/:${param.name.toLowerCase()}`));
        return route;
    }

    public plugin () {
        return options => {
            const senOpts = this.mySenecaOptions;

            const getParamsValue = obj => Maybe.fromNullable(obj.params).getOrElse(_.set(obj, "params", {}));
            const getParamName = param => Maybe.fromNullable(param.name).map(name => name.toLowerCase()).getOrElse("");
            const getParamNames = params => params.map(param => getParamName(param));
            const parseQuery = query => qs.parse(query, { allowDots: true });
            const extractPathParams = msg => nPath.parse(msg.request$.url.split("?")[0]).name;
            const extractParams = (parsedMsg, pNames) => _.pick(parsedMsg, pNames);
            const addParamsToObject = (obj, paramDefinitions, paramsSource) => Maybe.fromNullable(paramDefinitions)
                    .map(params => _.merge(
                        getParamsValue(obj),
                        extractParams(paramsSource, getParamNames(params))));

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
                        getParamsValue(payload);
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

    public addService (service): IEndpoint {
        this.myService = options => (msg, respond) => {
            try {
                const before = Maybe.fromNullable(this.myBefore).getOrElse(params => Promise.resolve(params));
                const after = Maybe.fromNullable(this.myAfter).getOrElse(params => Promise.resolve(params));
                before(msg.params)
                    .then(params =>  {
                        return service(params);
                    })
                    .then(result => {
                        respond(null, { ok: true, result });
                        return result;
                    })
                    .then(result => after(_.merge({}, msg.params, result)))
                    .catch(error => respond(null, { ok: false, result: error }));
            } catch (e) {
                respond(null, { ok: false, result: e });
            }
        };
        return this;
    }

    public addBefore (operation): IEndpoint {
        this.myBefore = this.wrapOperation(operation);
        return this;
    }

    public addAfter (operation): IEndpoint {
        this.myAfter = this.wrapOperation(operation);
        return this;
    }

    public broadcast(pattern) {
        console.log("========> emitting: " + pattern);
    }

    private wrapOperation (operation): Function {
        return params => {
            try {
                return operation(params);
            } catch (e) {
                throw e;
            }
        };
    }

    private registerService (options, service, params): IEndpoint {
        Maybe.fromNullable(options.seneca)
            .map(seneca => Maybe.fromNullable(service)
                .map(svc => seneca.add(_.merge(
                        params,
                        { default$: "This is a default response" })
                        , svc(options)
                    )
                )
            );
        return this;
    }
}
