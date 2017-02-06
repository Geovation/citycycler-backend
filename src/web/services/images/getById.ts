import { Kind } from "../../../common/services/plugins/models";
import { datastore, queryImages } from "../../../common/utilities/datastore";
import { MicroserviceEndpoint } from "../microservice-endpoint";

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
    const kind: Kind = "Image";
    const id: number =  +params.id;
    const query = datastore.createQuery(kind)
        .filter("__key__", "=", datastore.key(["Image", id]));
    return queryImages(query, "getImageById");
};

// //////////////
// SENECA: end //
// //////////////

export const getById = new MicroserviceEndpoint("loadImage")
    .addSwaggerOperation(operation)
    .addService(service);
