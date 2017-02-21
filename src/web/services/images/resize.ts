import { MicroserviceEndpoint } from "../microservice-endpoint";
import * as gcloud from "@google-cloud/storage";
import * as Maybe from "data.maybe";
import * as promisify from "es6-promisify";
import * as getStream from "get-stream";
import * as getUri from "get-uri";
import * as _ from "lodash";
import * as path from "path";
import * as sharp from "sharp";
import * as logger from "winston";

// /////////////////////////////////////////////////////////////
// SWAGGER: start                                             //
// KEEP THIS UP-TO-DATE WHEN MAKING ANY CHANGES TO THE METHOD //
// /////////////////////////////////////////////////////////////

// ///////////////
// SWAGGER: END //
// ///////////////

// ////////////////
// SENECA: start //
// ////////////////

const defaultOpts = {
    resize: {
        mimeType: "png",
        name: "original",
        url: "",
    },
};
const gcStorage = gcloud(process.env.GOOGLE_APPLICATION_CREDENTIALS);
const images = gcStorage.bucket("timepix-dev");
const getUriAsPromise = promisify(getUri);

const service = (broadcast: Function, params: any): Promise<any> => {
    const opts = _.merge({}, defaultOpts.resize, Maybe.fromNullable(params.resize).getOrElse({}));
    const image = images.file(path.join(opts.url, `${opts.name}.${opts.mimeType}`));

    const getTransformer = () => new Promise((resolve, reject) => {
        switch (Maybe.fromNullable(opts.type).getOrElse("")) {
            case "thumbnail":
                resolve(sharp().resize(opts.width, opts.height).png());
                break;
            case "watermark":
                getUriAsPromise(params.body.watermarkUri)
                .then(watermarkStream => getStream.buffer(watermarkStream))
                .then(watermarkBuffer => {
                    resolve(sharp().resize(opts.width, opts.height).overlayWith(watermarkBuffer).png());
                })
                .catch(error => {
                    logger.error("Failed to create watermark transform", error);
                    reject(error);
                });
                break;
            default:
                resolve(sharp().png());
        }
    });

    return new Promise((resolve, reject) => {
        getTransformer()
        .then(transformer => {
            return getUriAsPromise(params.body.fileUri)
            .then(readStream => {
                return { readStream, transformer };
            })
            .catch(e => {
                logger.error("Failed to convert file Uri to stream", e);
                throw e;
            });
        })
        .then(({ readStream, transformer }) => {
            const writeStream = image.createWriteStream();
            writeStream.on("error", e => {
                throw e;
            });
            writeStream.on("finish", () => {
                resolve(params);
            });
            readStream.on("error", e => {
                throw e;
            });
            readStream
            .pipe(transformer)
            .pipe(writeStream);
        })
        .catch(err => {
            logger.error("Failed to transform image", err);
            reject(err);
        });
    });
};

// //////////////
// SENECA: end //
// //////////////

export const resize = new MicroserviceEndpoint("resizeImage")
    .addService(service);
