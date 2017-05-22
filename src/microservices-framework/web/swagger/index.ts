/**
 * DO NOT TOUCH IT. Ask Paul.
 */

import * as _ from "lodash";
import * as yaml from "node-yaml";
import * as path from "path";
import * as logger from "winston";

// local modules
import { config } from "../../config";
import { servicesHelper } from "../services";

const host = process.env.DOCURL ? process.env.DOCURL.split("//")[1] : "https://matchmyroute-backend.appspot.com";

// default headers to be added to all endpoints
const headers = {
    "access-control-allow-origin": {
        description: "Indicates whether the response can be shared with resources in the given origin",
        type: "string",
    },
    connection: {
        description: "Indicates whether or not the network connection stays open after current transaction finishes",
        type: "boolean",
    },
    "content-length": {
        description: "The MIME type of the request body",
        type: "integer",
    },
    date: {
        description: "The date and time at which the message originated",
        type: "string",
    },
};

const meta = {
    basePath: config.server.prefix,
    definitions: {
        AppMessage: {
            properties: {
                node: {
                    properties: {
                        ares: {
                            type: "string",
                        },
                        http_parser: {
                            type: "string",
                        },
                        icu: {
                            type: "string",
                        },
                        modules: {
                            type: "string",
                        },
                        node: {
                            type: "string",
                        },
                        openssl: {
                            type: "string",
                        },
                        uv: {
                            type: "string",
                        },
                        v8: {
                            type: "string",
                        },
                        zlib: {
                            type: "string",
                        },
                    },
                },
                test: {
                    type: "string",
                },
            },
            required: [
                "node",
                "test",
            ],
            title: "AppMessage",
            type: "object",
        },
        Error: {
            properties: {
                detail: {
                    type: "object",
                },
                error: {
                    type: "string",
                },
                path: {
                    type: "string",
                },
                status: {
                    type: "integer",
                },
            },
            required: [
                "status",
                "error",
            ],
            title: "Error",
            type: "object",
        },
    },
    host,
    info: {
        description: "The MatchMyRoute API",
        title: "matchmyroute-api",
        version: "1.0.0",
    },
    paths: {
        "/": {
            get: {
                consumes: ["text/plain"],
                description: "Return the web application",
                operationId: "default",
                produces: ["text/plain; charset=utf-8"],
                responses: {
                    200: {
                        description: "The application is being served",
                        schema: {
                            $ref: "#/definitions/AppMessage",
                        },
                        headers,
                    },
                    default: {
                        description: "error payload",
                        schema: {
                            $ref: "#/definitions/Error",
                        },
                        headers,
                    },
                },
                tags: ["application"],
            },
        },
    },
    securityDefinitions: {
        userAuth: {
            description: "JWT based user authetication system. Expects a value of 'Bearer JWT'",
            in: "header",
            name: "Authorization",
            type: "apiKey",
        },
    },
    swagger: "2.0",
};

/** @function addHeaders
 *
 *  Iterates recursively through definition objects and appends common headers to all endpoint responses.
 *
 *  @param  path - The path whose reponses common headers have to be appended
 */
const addHeaders = path => {
    _.forIn(path, (val, key) => {
        if (key === "responses") {
            // we're in the right place, add the headers
            _.each(_.valuesIn(val), response => _.merge(response, { headers }));
        } else if (typeof val !== "object") {
            // we've got to the bottom of the tree
            return;
        } else {
            // we're not at the bottom of the tree yet
            addHeaders(val);
        }
    });
};

const compileSwagger = () => {
    const paths = servicesHelper.endpointCollection.endpointPaths();
    addHeaders(paths);
    _.merge(meta.paths, paths);
    _.merge(meta.definitions, servicesHelper.endpointCollection.endpointDefinitions());
    _.merge(meta.securityDefinitions, servicesHelper.endpointCollection.endpointSecurityDefinitions());
};

yaml.write(path.join(process.cwd(), (process.env.STATIC_DIR || "build/static") + "/swagger.yaml"),
    meta, "utf8", (err) => {
        if (err) {
            throw err;
        }
        logger.log("info", "swagger.yaml saved");
    });

export const getSwaggerJson = () => {
    return meta;
};
/* tslint:disable only-arrow-functions */
export const getSwaggerJsonGenerator = function* (next) {
    compileSwagger();
    return meta;
};
/* tslint:enable only-arrow-functions */
