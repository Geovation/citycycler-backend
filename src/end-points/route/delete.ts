import { isUser } from "../../common/auth";
import * as Database from "../../common/database";
import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";
// import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    delete: {
        consumes: ["application/json"],
        parameters: [
            {
                description: "The route ID",
                in: "query",
                name: "id",
                required: true,
                type: "integer",
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
                description: "The route was deleted",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        summary: "Delete a route",
        tags: [
            "Route Deletion",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const service = (broadcast: Function, params: any): Promise<any> => {
    const id = parseInt(params.id, 10);

    if (isUser(params.authorisation, id)) {
        return Database.deleteRoute(id);
    } else {
        return new Promise((resolve, reject) => { reject("Invalid authorisation"); });
    }
};

// end point definition
export const deleteRoute = new MicroserviceEndpoint("delete")
    .addSwaggerOperation(operation)
    .addService(service);
