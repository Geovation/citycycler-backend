
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
        description: "Returns images from the databases.",
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "A list of image metadata summaries.",
                examples: {
                    result: [
                        { thumbnail: "http://timepix.com/images/picture1.jpg" },
                        { thumbnail: "http://timepix.com/images/picture2.png" },
                        { thumbnail: "http://timepix.com/images/picture3.tiff" },
                        { thumbnail: "http://timepix.com/images/picture4.gif" },
                    ],
                },
                schema: {
                    $ref: "#/definitions/ImageMetadataSummary",
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

// DEFINITIONS
const definitions = {
    ImageMetadataSummary: {
        items: {
            properties: {
                thumbnail: {
                    type: "string",
                },
            },
        },
        type: "array",
    },
};

// ///////////////
// SWAGGER: end //
// ///////////////

// ////////////////
// SENECA: start //
// ////////////////

const service = (params): Promise<any> => {
    const kind: Kind = "Image";
    const query = datastore.createQuery(kind);
    return queryImages(query, "getImage");
};

// //////////////
// SENECA: end //
// //////////////

export const get = new MicroserviceEndpoint("listImages")
    .addSwaggerOperation(operation)
    .addSwaggerDefinitions(definitions)
    .addService(service);
