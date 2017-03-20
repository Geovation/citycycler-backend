import { generateJWTFor, getIdFromJWT } from "../../../common/auth";
import * as Database from "../../../common/database";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    get: {
        consumes: ["application/json"],
        description: "This endpoint accepts an old JWT and returns a current JWT. " +
        "Should be called when the old JWT is within a day of it's expiration.",
        parameters: [
            {
                description: "The user's JWT token",
                in: "header",
                name: "Authorisation",
                required: true,
                type: "string",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "New JWT produced",
                schema: {
                    $ref: "#/definitions/JWTResponse",
                },
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        security: [
            {
                userAuth: [],
            },
        ],
        summary: "Get a new token",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    JWTResponse: {
        description: "The JWT generated",
        properties: {
            result: {
                example: "eyJhbGciOiJI...28ZZEY",
                required: true,
                type: "string",
            },
        },
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        getIdFromJWT(params.authorisation).then(userid => {
            Database.getUserById(userid).then(user => {
                resolve(generateJWTFor(user));
            });
        });
    });
};

// end point definition
export const regenerate = new MicroserviceEndpoint("reAuth")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
