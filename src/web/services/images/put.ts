import { MicroserviceEndpoint } from "../microservice-endpoint";
import * as _ from "lodash";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// PATH
const operation = {
    post: {
        consumes: ["application/json"],
        description: "Uploads an image, processes the image creating a thumbnail and 4 other " +
        "formats and saves all of it into the DB",
        parameters: [
            {
                description: "Image data URI",
                in: "body",
                name: "images",
                required: true,
                type: "string",
            },
        ],
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "successful operation",
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

const service = (broadcast: Function, params: any): Promise<any> => {
    let mimeType = "png";
    try {
        mimeType = _.split(_.split(params.body.fileUri, ";", 1)[0], "/", 2).reverse()[0];
    } catch (e) {
        // ignore, we don't care
    }
    const originalImageOptions = { resize:
        {
            mimeType,
            url: "images/654321/",
        },
    };
    const resizeImageOptions = [
        originalImageOptions,
        _.merge({}, originalImageOptions, { resize: { height: 100, name: "thumb", type: "thumbnail" } }),
        _.merge({}, originalImageOptions, { resize: { height: 250, name: "cc", type: "watermark" } }),
    ];

    return Promise.all(resizeImageOptions.map(opts => broadcast("resizeImage", _.merge({}, params, opts))));
};

// end point definition
export const put = new MicroserviceEndpoint("putImage")
    .addSwaggerOperation(operation)
    .addService(service);
