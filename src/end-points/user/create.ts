import { generateJWTFor, minimumHashingRounds } from "../../common/auth";
import * as CloudStorage from "../../common/cloudstorage";
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
    put: {
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
            409: {
                description: "A user already exists with this email address",
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
            bio: {
                description: "The user's short biography",
                example: "Hi, I'm Joe Blogs and I've been cycling London since I was 12.",
                type: "string",
            },
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
            photo: {
                description: "A profile photo for the user",
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
                properties: {
                    expires: {
                        example: 123456789,
                        type: "integer",
                    },
                    token: {
                        example: "eyJhbGciOiJI...28ZZEY",
                        type: "string",
                    },
                },
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
    const { email, password, name, bio, photo } = payload;
    // Work out the user's password hash and salt.
    // We are using PBKDF2 with 50000 iterations and sha512.
    const rounds = minimumHashingRounds;
    const salt = crypto.randomBytes(128);
    const jwtSecret = crypto.randomBytes(20).toString("base64");
    let createdUser;
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
        let sqlParams = {name, email, pwh, salt, rounds, jwt_secret: jwtSecret};
        if (typeof bio !== "undefined") {
            sqlParams.profile_bio = bio;
        }
        return Database.putUser(sqlParams);
    }).then(user => {
        createdUser = user;
        if (typeof photo !== "undefined") {
            console.log("photo found, will upload");
            return CloudStorage.storeProfileImage(payload.photo, user.id)
            .then((profileImgUrl) => {
                return {
                    id: createdUser.id,
                    jwt: generateJWTFor(createdUser),
                    profileImgUrl,
                    status: 201,
                };
            });
        } else {
            return {
                id: createdUser.id,
                jwt: generateJWTFor(createdUser),
                status: 201,
            };
        }
    });
};

// end point definition
export const createUser = new MicroserviceEndpoint("createUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
