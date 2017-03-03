import { MicroserviceEndpoint } from "../../microservices-framework/web/services/microservice-endpoint";

import * as Maybe from "data.maybe";
import * as promisify from "es6-promisify";
import * as getStream from "get-stream";
import * as getUri from "get-uri";
import * as _ from "lodash";
import * as path from "path";
import * as Sharp from "sharp";
import * as logger from "winston";

import { getImageWritableStream } from "../../common/storage";

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

function callResizeByLongestSideFn(resizeFn: Function, md, size) {
    const width = md.width;
    const height = md.height;
    const max = Math.max(width, height);
    return resizeFn(size * width / max, size * height / max);
}

export const callResizeFn = {
    business: (resizeFn: Function, opts, md) => resizeFn(Math.floor(md.width), Math.floor(md.height)),
    cc: (resizeFn: Function, opts, md) => callResizeByLongestSideFn(resizeFn, md, 1080),
    personal: (resizeFn: Function, opts, md) => callResizeByLongestSideFn(resizeFn, md, 1500),
    thumbnail: (resizeFn: Function, opts, md) => callResizeByLongestSideFn(resizeFn, md, 100),
};

const service = (broadcast: Function, params: any): Promise<any> => {
    const opts = _.merge({}, defaultOpts.resize, Maybe.fromNullable(params.resize).getOrElse({}));
    Maybe.fromNullable(opts.type).orElse(() => opts.type = "enhanced");
    let uniqueUrl;

    const getTransformer = ({ sharp, md }) => new Promise((resolve, reject) => {
        uniqueUrl = path.join(opts.id, `${opts.type}.${md.format}`);

        sharp = callResizeFn[opts.type](sharp.resize, opts, md);

        if (opts.type === "cc") {
            sharp = sharp.overlayWith(
                path.join(__dirname, "/../../../conf/watermark.png"),
                {
                    gravity: Sharp.gravity.northwest,
                    tile: true,
                });
        }

        resolve(sharp);
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
