import { APIEndpoint } from "../api-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const path = {
    get: {
        consumes: ["application/json"],
        description: "Returns an image matching the passed ID.",
        parameters: [{
            description: "The ID of the image to be returned",
            in: "path",
            name: "id",
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

export const getById = new APIEndpoint({
        cmd: "getById",
        path: "load",
        role: "image",
    })
    .addPath(path);
