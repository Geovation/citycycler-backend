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
        parameters: [],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "New JWT produced",
                schema: {
                    $ref: "#/definitions/JWTResponse",
                },
            },
            403: {
                description: "An invalid authorisation token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
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

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<{ token: string; expires: number; }> => {
    return getIdFromJWT(params.authorisation).then(userid => {
        return Database.runTransaction(Database.getUserById, userid, false);
    }).then(user => {
        return generateJWTFor(user);
    }).catch(err => {
        throw err;
    });
};

// end point definition
export const regenerate = new MicroserviceEndpoint("reAuth")
    .addSwaggerOperation(operation)
    .addService(service);
