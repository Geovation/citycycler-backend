import { ISwaggerEndpoint } from "../../../../common/interfaces";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const paths = {
    get: {
        consumes: ["application/json"],
        description: "Returns a hard-coded array of objects to test UI/API communicaiton and microservice endpoint.",
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

// Handle request
export const getMetadataSummary = options => {
    const seneca = options.seneca;

    // expose the role:api,path:calculate pattern via the api
    seneca.add("role:api,path:images", (msg, respond) => {
        try {
            seneca.act("role:image", {
                cmd: "get",
            }, respond);
        } catch (err) {
            return respond(null, err);
        }
    });
};

const routes = { images: { GET: true } };

export const get: ISwaggerEndpoint = {
    definitions,
    get: getMetadataSummary,
    paths,
    routes,
};
