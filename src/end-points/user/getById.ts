import { getIdFromJWT } from "../../common/auth";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// OPERATION
const operation = {
    get: {
        consumes: ["application/json"],
        description: "Returns a user matching the passed ID. If the user is not present, an empty object will be " +
        "returned.",
        parameters: [
            {
                description: "The ID of the user to be returned",
                in: "path",
                name: "id",
                required: true,
                type: "number",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "The requested User or an empty object",
                schema: {
                    $ref: "#/definitions/GetUserResponse",
                },
            },
            403: {
                description: "An invalid authorisation token was supplied",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
            404: {
                description: "No user exists with the given id",
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
        summary: "Get a user by ID",
        tags: [
            "Users",
        ],
    },
};

// DEFINITIONS

const definitions = {
    GetUserResponse: {
        description: "The requested User or an empty object",
        properties: {
            result: {
                $ref: "#/definitions/User",
            },
        },
        required: ["result"],
    },
    User: {
        description: "A User object",
        properties: {
            email: {
                description: "The user's email address",
                example: "joe@blogs.com",
                type: "string",
            },
            id: {
                description: "The user's database ID",
                type: "number",
            },
            name: {
                description: "The user's full name",
                example: "Joe Blogs",
                type: "string",
            },
        },
        required: ["email", "id", "name"],
    },
};

// ///////////////
// SWAGGER: end //
// ///////////////

const service = (broadcast: Function, params: any): any => {
    const id = parseInt(params.id, 10);
    try {
        if (!params.authorisation) {
            throw "403:Invalid authorisation";
        }
        getIdFromJWT(params.authorisation);
        Database.getUserById(id).then(user => {
            return user.asUserProfile();
        });
    } catch (err) {
        throw err;
    }
};

export const getById = new MicroserviceEndpoint("getUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
