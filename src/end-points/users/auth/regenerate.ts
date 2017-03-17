import * as Database from "../../../common/database";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";
import { generateJWTFor } from "./generate";
import * as jwt from "jsonwebtoken";
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

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<string> => {
    return new Promise((resolve, reject) => {
        const [scheme, oldToken] = params.authorisation.split(" ");
        if (scheme !== "Bearer") {
            reject("Invalid Authorisation scheme. This API requires 'Bearer JWT'");
        }
        // Decode the old JWT to get the user ID
        // This does NOT verify the JWT
        let payload;
        try {
            payload = jwt.decode(oldToken, {
                json: true,
            });
        } catch (err) {
            resolve("Invalid token. " + err);
        }
        // Get the user, so we can use their secret to verify the JWT
        Database.getUserById(payload.id).then((user) => {
            try {
                jwt.verify(oldToken, user.jwtSecret, {
                    algorithms: ["HS256"],
                    issuer: "MatchMyRoute Backend",
                });
                resolve(generateJWTFor(user));
            } catch (err) {
                reject("Invalid token for this user" + err);
            }
        }, err => {
            resolve("Error querying database: " + err);
        });
    });
};

// end point definition
export const regenerate = new MicroserviceEndpoint("reAuth")
    .addSwaggerOperation(operation)
    .addService(service);
