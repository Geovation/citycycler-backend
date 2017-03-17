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
                description: "This should present the JWT as Bearer: JWT",
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
        summary: "Swap an old token for a new one",
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
        const [scheme, oldToken] = params.authorisation.split(" ");
        if (scheme !== "Bearer") {
            reject("Invalid Authorisation scheme. This API requires 'Bearer JWT'");
        }
        getIdFromJWT(oldToken).then(userid => {
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
