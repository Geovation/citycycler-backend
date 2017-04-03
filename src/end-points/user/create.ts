import { generateJWTFor } from "../../common/auth";
import * as Database from "../../common/database";
import { UserFullDataModel } from "../../common/UserFullDataModel";
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
                    $ref: "#/definitions/NewUser",
                },
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            201: {
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
                $ref: "#/definitions/NewUserResult",
            },
        },
        required: ["result"],
    },
    NewUser: {
        description: "A User object",
        // example: [[0, 0], [1, 1]],
        properties: {
            email: {
                description: "The user's email address",
                example: "joe@blogs.com",
                type: "string",
            },
            name: {
                description: "The user's full name",
                example: "Joe Blogs",
                type: "string",
            },
            password: {
                description: "The user's password",
                type: "string",
            },
        },
        required: ["email", "name", "password"],
    },
    NewUserResult: {
        properties: {
            id: {
                description: "The new user's ID",
                format: "int32",
                type: "number",
            },
            jwt: {
                description: "The authorised JWT",
                example: "eyJhbGciOiJI...28ZZEY",
                type: "string",
            },
        },
        required: ["id", "jwt"],
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
        if (email.trim().length === 0) {
            reject("400:Email Required");
            return;
        } else if (password.trim().length === 0) {
            reject("400:Password Required");
            return;
        } else if (name.trim().length === 0) {
            reject("400:Name Required");
            return;
        }
        crypto.pbkdf2(password, salt, rounds, 512, "sha512", (err, key) => {
            if (err) {
                reject(err);
            } else {
                resolve(key);
            }
        });
    }).then(pwh => {
        return Database.putUser(name, email, pwh, salt, rounds, jwtSecret);
    }).then((user: UserFullDataModel) => {
        return {
            id: user.id,
            jwt: generateJWTFor(user),
            status: 201,
        };
    });
};

// end point definition
export const createUser = new MicroserviceEndpoint("createUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
