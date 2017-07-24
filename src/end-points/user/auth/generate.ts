import { generateJWTFor, minimumHashingRounds } from "../../../common/auth";
import * as Database from "../../../common/database";
import { MicroserviceEndpoint } from "../../../microservices-framework/web/services/microservice-endpoint";
import * as crypto from "crypto";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    post: {
        consumes: ["application/json"],
        description: "This endpoint accepts a user's email and password, and returns the user +" +
            " a JWT that expires after 1 week",
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
                schema: {
                    $ref: "#/definitions/JWTResponse",
                },
            },
            403: {
                description: "An incorrect email/password combination was given",
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
                type: "string",
            },
            password: {
                description: "The user's password",
                type: "string",
            },
        },
        required: ["email", "password"],
    },
    JWTResponse: {
        description: "The JWT generated",
        properties: {
            result: {
                description: "The JWT for this user and it's expiry date",
                properties: {
                    expires: {
                        example: 123456789,
                        type: "integer",
                    },
                    firebaseToken: {
                        example: "eyJhbGciOiJI...28ZZEY",
                        type: "string",
                    },
                    token: {
                        example: "eyJhbGciOiJI...28ZZEY",
                        type: "string",
                    },
                    user: {
                        $ref: "#/definitions/User",
                    },
                },
                required: ["expires", "token", "user"],
            },
        },
        required: ["result"],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const payload = params.body;
    const { email, password } = payload;
    // Check that the password has matches what we have stored.
    let transactionClient;
    let thisUser;
    return Database.createTransactionClient().then(newClient => {
        transactionClient = newClient;
        return Database.getUserByEmail(email, transactionClient);
    }).then(user => {
        thisUser = user;
        return new Promise((resolve, reject) => {
            crypto.pbkdf2(password, user.salt, user.rounds, 512, "sha512", (err, key) => {
                if (err) {
                    reject(err);
                } else if (Buffer.compare(key, user.pwh) === 0) {
                    if (user.rounds !== minimumHashingRounds) {
                        // Update user's password
                        crypto.pbkdf2(password, user.salt, minimumHashingRounds, 512, "sha512", (newErr, newKey) => {
                            const updates = {
                                password: newKey,
                                rounds: minimumHashingRounds,
                            };
                            // Not using the transactionClient here because this DB task should be asynchronous,
                            // and the client will probably be released before it's done with this update
                            Database.updateUser(user.id, updates);
                        });
                    }
                    Database.commitAndReleaseTransaction(transactionClient);
                    resolve(user);
                } else {
                    reject("403:Incorrect Password");
                }
            });
        });
    })
    .then(user => {
        return generateJWTFor(user);
    })
    .then(tokenResponse => {
        // Add the user to the response
        let response = Object.assign(tokenResponse, {
            user: thisUser.asUserProfile(),
        });
        return response;
    })
    .catch(err => {
        const originalError = typeof err === "string" ? err : err.message;
        if (typeof transactionClient !== "undefined") {
            return Database.rollbackAndReleaseTransaction(transactionClient)
            .then(() => {
                if (originalError === "404:User doesn't exist") {
                    throw new Error("403:Incorrect Password");
                } else {
                    throw new Error(originalError);
                }
            });
        } else {
            throw new Error(originalError);
        }
    });
};

// end point definition
export const generate = new MicroserviceEndpoint("newAuth")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
