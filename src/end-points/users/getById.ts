import { doIfUser } from "../../common/auth";
import * as Database from "../../common/database";
import { UserLiteDataModel } from "../../common/UserLiteDataModel";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// OPERATION
const operation = {
    get: {
        consumes: ["application/json"],
        description: "Returns an user matching the passed ID. If the user is not present, an empty object will be " +
        "returned.",
        parameters: [
            {
                description: "The ID of the user to be returned",
                in: "path",
                name: "id",
                required: true,
                type: "number",
            },
            {
                description: "The user's JWT token",
                in: "header",
                name: "Authorisation",
                required: true,
                type: "string",
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
    return doIfUser(params.authorisation, id, () => {
        return Database.getUserById(id).then(user => {
            return new UserLiteDataModel(user);
        });
    });
};

export const getById = new MicroserviceEndpoint("getUser")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
