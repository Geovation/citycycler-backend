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
import { LicenseType } from "../../common/types";
import { SharpInstance } from "sharp";

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

type Opts = {
    id?: any,
    public?: boolean,
    resize: {
        id: any,
        public: boolean,
    },
    type: LicenseType,
}

const defaultOpts: Opts = {
    resize: {
        id: "",
        public: false,
    },
    type: "business",
};
const getUriAsPromise = promisify(getUri);

function callResizeByLongestSideFn(sharp: SharpInstance, md, size) {
    const width = md.width;
    const height = md.height;
    const max = Math.max(width, height);
    const newWidth = Math.round(size * width / max);
    const newHeight = Math.round(size * height / max);
    return sharp.resize(newWidth, newHeight);
}

export const callResizeFn = {
    business: (sharp: SharpInstance, md) => sharp.resize(Math.floor(md.width), Math.floor(md.height)),
    cc: (sharp: SharpInstance, md) => callResizeByLongestSideFn(sharp, md, 1080),
    personal: (sharp: SharpInstance, md) => callResizeByLongestSideFn(sharp, md, 1500),
    thumbnail: (sharp: SharpInstance, md) => callResizeByLongestSideFn(sharp, md, 100),
};

const service = (broadcast: Function, params: any): Promise<any> => {
    const opts: Opts = _.merge({}, defaultOpts.resize, Maybe.fromNullable(params.resize).getOrElse({}));
    Maybe.fromNullable(opts.type).orElse(() => opts.type = "business");
    let uniqueUrl;

    const getTransformer = ({ sharp, md }) => new Promise((resolve, reject) => {
        uniqueUrl = path.join(opts.id, `${opts.type}.jpeg`);

        // resize
        sharp = callResizeFn[opts.type](sharp, md);

        // watermark
        if (opts.type === "cc") {
            sharp = sharp.overlayWith(
                path.join(__dirname, "/../../../conf/watermark.png"),
                {
                    gravity: Sharp.gravity.northwest,
                    tile: true,
                });
        }

        // jpeg
        sharp = sharp.jpeg({ quality: 100 });

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
