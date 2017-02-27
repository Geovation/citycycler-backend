import { getImageWritableStream } from "../../common/storage";
import { MicroserviceEndpoint } from "../microservice-endpoint";
import * as Maybe from "data.maybe";
import * as promisify from "es6-promisify";
import * as getStream from "get-stream";
import * as getUri from "get-uri";
import * as _ from "lodash";
import * as path from "path";
import * as Sharp from "sharp";
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
        id: "",
        public: false,
    },
};
const getUriAsPromise = promisify(getUri);

const service = (broadcast: Function, params: any): Promise<any> => {
    const opts = _.merge({}, defaultOpts.resize, Maybe.fromNullable(params.resize).getOrElse({}));
    Maybe.fromNullable(opts.type).orElse(() => opts.type = "enhanced");
    let uniqueUrl;

    const getTransformer = ({ sharp, md }) => new Promise((resolve, reject) => {
        uniqueUrl = path.join(opts.id, `${opts.type}.${md.format}`);
        switch (opts.type) {
            case "thumbnail":
                resolve(sharp.resize(opts.width, opts.height));
                break;
            case "cc":
                resolve(sharp
                        .resize(Math.floor(md.width * 0.25), Math.floor(md.height * 0.25))
                        .overlayWith(
                            path.join(__dirname, "/../../../conf/watermark.png"),
                            {
                                gravity: Sharp.gravity.northwest,
                                tile: true,
                            }));
                break;
            case "personal":
                resolve(sharp.resize(Math.floor(md.width * 0.5), Math.floor(md.height * 0.5)));
                break;
            case "business":
                resolve(sharp.resize(Math.floor(md.width * 0.75), Math.floor(md.height * 0.75)));
                resolve();
                break;
            default:
                resolve(sharp);
        }
    });

    const getMetadata = buff => {
        return new Promise((resolve, reject) => {
            let sharp = Sharp(buff);
            sharp
            .metadata()
            .then(md => resolve({ sharp, md }))
            .catch(e => reject(e));
        });
    };

    return new Promise((resolve, reject) => {
        getUriAsPromise(params.body.fileUri)
        .then(readStream => getStream.buffer(readStream))
        .then(buff => getMetadata(buff))
        .then(results => getTransformer(results))
        .then(transformer => {
            const writeStream = getImageWritableStream(path.join("images", uniqueUrl), opts.public);
            transformer.on("error", e => reject(e));
            writeStream.on("error", e => reject(e));
            writeStream.on("finish", () => resolve({
                type: opts.type,
                url: `${process.env.IMAGES_URL}/${uniqueUrl}`,
            }));
            transformer
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
