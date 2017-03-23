import { doIfUser, minimumHashingRounds } from "../../common/auth";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
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
        description: "This endpoint accepts an object that contains fields that the user wishes to update. " +
        "Any fields not in the update object will not be modified.",
        parameters: [
            {
                description: "The updated user settings",
                in: "body",
                name: "user",
                required: true,
                schema: {
                    $ref: "#/definitions/UpdateUser",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "User was updated",
                schema: {
                    $ref: "#/definitions/UpdateUserResponse",
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
        summary: "Update a user's settings",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    UpdateUser: {
        description: "A User object",
        properties: {
            email: {
                description: "The user's new email address",
                example: "joe@blogs.com",
                type: "string",
            },
            id: {
                description: "The user's id",
                example: 123,
                type: "integer",
            },
            name: {
                description: "The user's new full name",
                example: "Joe Blogs",
                type: "string",
            },
            password: {
                description: "The user's new password",
                type: "string",
            },
        },
        required: ["id"],
    },
    UpdateUserResponse: {
        properties: {
            result: {
                description: "Whether the update succeded",
                type: "boolean",
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
    return doIfUser(params.authorisation, payload.id, () => {
        return new Promise((resolve, reject) => {
            let updates: any = {};
            let promises = [];
            if (payload.id === undefined) {
                reject("User ID required");
                return;
            }
            if (payload.name !== undefined && payload.name.trim().length !== 0) {
                updates.name = payload.name;
            }
            if (payload.email !== undefined && payload.email.trim().length !== 0) {
                updates.email = payload.email;
            }
            if (payload.password !== undefined && payload.password.trim().length !== 0) {
                // Generate the new password hash
                promises.push(Database.getUserById(payload.id).then(user => {
                    let rounds = minimumHashingRounds;
                    return new Promise((innerResolve, innerReject) => {
                        crypto.pbkdf2(payload.password.trim(), user.salt, rounds, 512, "sha512", (err, key) => {
                            if (err) {
                                innerReject("Error hashing: " + err);
                            } else {
                                let kvs: any = [["pwh", key]];
                                if (user.rounds !== minimumHashingRounds) {
                                    kvs.push([
                                        "rounds", minimumHashingRounds,
                                    ]);
                                }
                                innerResolve(kvs);
                            }
                        });
                    });
                }, err => {
                    reject("Error getting user: " + err);
                }));
            }
            Promise.all(promises).then(kvss => {
                kvss.forEach((kvs) => {
                    kvs.forEach((kv) => {
                        updates[kv[0]] = kv[1];
                    });
                });
                if (!updates) {
                    resolve(true);
                } else {
                    Database.updateUser(payload.id, updates).then(success => {
                        resolve(success);
                    }, err => {
                        reject("Error updating user: " + err);
                    });
                }
            }, err => {
                reject("Error updating user: " + err);
            });
        });
    });
};

// end point definition
export const updateUser = new MicroserviceEndpoint("updateUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
