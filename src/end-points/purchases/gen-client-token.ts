// import * as Auth from "../../common/auth";
// import * as Datastore from "../../common/datastore";
// import { ImageMetadataModel } from "../../common/ImageMetadataModel";

import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

// import * as _ from "lodash";
// import * as logger from "winston";
import * as braintree from "braintree";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// TODO:
// PATH
const operation = {
    get: {
        consumes: ["application/json"],
        description: "generate a client token",
        produces: ["application/json; charset=utf-8"],
        responses: {
            200: {
                description: "A braintree client token",
                type: "string",
            },
            default: {
                description: "unexpected error",
                schema: {
                    $ref: "#/definitions/Error",
                },
            },
        },
        tags: [
            "braintree",
        ],
    },
};

// ///////////////
// SWAGGER: END //
// ///////////////

// TODO: see https://developers.braintreepayments.com/start/hello-server/node
export const service = (broadcast: Function, params: any): Promise<any> => {

    // TODO: externalize this.
    const gateway = braintree.connect({
        environment:  braintree.Environment.Sandbox,
        merchantId:   "4hcgw7nv2yycwpqv",
        privateKey:   "e65d3b5b238cf81f89da318bd32f335f",
        publicKey:    "9d6mrznj7mjpbxzn",
    });

    // TODO: cache it
    return new Promise((resolve, reject) => {
        gateway.clientToken.generate({}, (err, response) => {
            if (!err) {
                resolve(response.clientToken);
            } else {
                reject(err);
            }
        });
    });
};

// end point definition
export const genClientToken = new MicroserviceEndpoint("genBraintreeClientToken")
    .addSwaggerOperation(operation)
    .addService(service);
