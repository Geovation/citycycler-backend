import { MicroserviceEndpoint } from "../microservice-endpoint";

import * as Datastore from "../../common/datastore";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// OPERATION
const operation = {
    get: {
        consumes: ["application/json"],
        parameters: [{
            description: "The ID of the image to be returned",
            in: "path",
            name: "id",
            required: true,
            type: "string",
        }],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "A welcome message.",
                schema: {
                    $ref: "#/definitions/APIMessage",
                },
            },
            default: {
                description: "unexpected error",
                schema: {
                  $ref: "#/definitions/Error",
                },
            },
        },
        tags: [
            "images",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

// ////////////////
// SENECA: start //
// ////////////////

const service = (params): Promise<any> => {
    return Datastore.getImageById(Number(params.id));
};

// //////////////
// SENECA: end //
// //////////////

export const getById = new MicroserviceEndpoint("loadImage")
    .addSwaggerOperation(operation)
    .addService(service);
