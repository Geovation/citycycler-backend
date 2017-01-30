import { APIEndpoint } from "../api-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const path = {
    get: {
        consumes: ["application/json"],
        description: "Returns images from the databases.",
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "A list of image metadata summaries.",
                example: {
                    "application/json": [
                        { url: "http://timepix.com/images/picture1.jpg" },
                        { url: "http://timepix.com/images/picture2.png" },
                        { url: "http://timepix.com/images/picture3.tiff" },
                        { url: "http://timepix.com/images/picture4.gif" },
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
                url: {
                    type: "string",
                },
            },
        },
        type: "array",
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

export const get = new APIEndpoint({
        cmd: "get",
        path: "list",
        role: "image",
    })
    .addPath(path)
    .addDefinitions(definitions);
