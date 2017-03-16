import * as Database from "../../../common/database";
import { UserDataModel } from "../../../common/UserDataModel";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";
import * as crypto from "crypto";
import * as jwt from "jsonwebtoken";
import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    post: {
        consumes: ["application/json"],
        description: "This endpoint accepts a user's email and password, and returns a JWT that expires after 1 week.",
        parameters: [
            {
                description: "The data needed to authorise this user",
                in: "body",
                name: "auth",
                required: true,
                schema: {
                    $ref: "#/definitions/AuthInfo",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "User was authorised",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        summary: "Get a token for a user",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    AuthInfo: {
        description: "Information needed to authorise this user",
        properties: {
            email: {
                description: "The user's email address",
                required: true,
                type: "string",
            },
            password: {
                description: "The user's password",
                required: true,
                type: "string",
            },
        },
        required: true,
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    const { email, password } = payload;
    // Check that the password has matches what we have stored.
    // TODO: Check that the user's stored rounds is current. Re-hash if not.
    const rounds = 50000;
    return Database.getUserByEmail(email).then((user) => {
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, user.salt, user.rounds, 512, "sha512", (err, key) => {
                if (err) {
                    reject(err);
                } else if (Buffer.compare(key, user.pwh) === 0) {
                    resolve(true);
                } else {
                    reject("Invalid password");
                }
            });
        }).then(success => {
            return generateJWTFor(user);
        }, err => {
            throw err;
        });
    });
};

// end point definition
export const generate = new MicroserviceEndpoint("auth")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);

// Generates a JWT for this user id, that expires in 2 weeks
export const generateJWTFor = (user: UserDataModel): string => {
    return jwt.sign({ id: user.id }, user.jwtSecret, {
        algorithm: "HS256",
        expiresIn: 1209600,	// 2 weeks
        issuer: "MatchMyRoute Backend",
    });
};
