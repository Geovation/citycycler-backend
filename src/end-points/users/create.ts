import { generateJWTFor } from "../../common/auth";
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
        parameters: [
            {
                description: "The new user",
                in: "body",
                name: "user",
                required: true,
                schema: {
                    $ref: "#/definitions/User",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "New user was created",
                schema: {
                    $ref: "#/definitions/CreateResponse",
                },
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        summary: "Create a new user",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    CreateResponse: {
        description: "The new user's ID and an authorised JWT",
        properties: {
            result: {
                required: true,
                schema: {
                    $ref: "#/definitions/NewUserResult",
                },
                type: "object",
            },
        },
    },
    NewUserResult: {
        properties: {
            id: {
                description: "The new user's ID",
                format: "int32",
                required: true,
                type: "number",
            },
            jwt: {
                description: "The authorised JWT",
                example: "eyJhbGciOiJI...28ZZEY",
                required: true,
                type: "string",
            },
        },
    },
    User: {
        description: "A User object",
        // example: [[0, 0], [1, 1]],
        properties: {
            email: {
                description: "The user's email address",
                example: "joe@blogs.com",
                required: true,
                type: "string",
            },
            name: {
                description: "The user's full name",
                example: "Joe Blogs",
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
    const { email, password, name } = payload;
    // Work out the user's password hash and salt.
    // We are using PBKDF2 with 50000 iterations and sha512.
    const rounds = 50000;
    const salt = crypto.randomBytes(128);
    const jwtSecret = crypto.randomBytes(20).toString("base64");
    return new Promise((resolve, reject) => {
        crypto.pbkdf2(password, salt, rounds, 512, "sha512", (err, key) => {
            if (err) {
                reject(err);
            } else {
                resolve(key);
            }
        });
    }).then(pwh => {
        return Database.putUser(name, email, pwh, salt, rounds, jwtSecret).then((user) => {
            return {
                id: user.id,
                jwt: generateJWTFor(user),
            };
        });
    }, err => {
        throw "Couldn't generate password hash: " + err;
    });
};

// end point definition
export const createUser = new MicroserviceEndpoint("createUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
