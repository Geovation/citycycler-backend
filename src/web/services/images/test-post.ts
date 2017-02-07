import { MicroserviceEndpoint } from "../microservice-endpoint";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// OPERATION
const operation = {
    post: {
        consumes: ["application/json"],
        parameters: [{
            description: "The ID of the image to be returned",
            in: "body",
            name: "stuff",
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
    console.log("params =======> ", params);
    return Promise.resolve(params.body);
};
const before = (params): Promise<any> => {
    console.log("RUNNING BEFORE ======> ", params);
    testPost.broadcast("before");
    return Promise.resolve(params);
};
const after = (params): Promise<any> => {
    console.log("RUNNING AFTER ======> ", params);
    testPost.broadcast("after");
    return Promise.resolve(params);
};

// //////////////
// SENECA: end //
// //////////////

export const testPost = new MicroserviceEndpoint("testPost")
    .addSwaggerOperation(operation)
    .addService(service)
    .addBefore(before)
    .addAfter(after);
