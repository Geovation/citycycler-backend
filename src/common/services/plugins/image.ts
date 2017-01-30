import * as Datastore from "@google-cloud/datastore";
import * as promisify from "es6-promisify";
import * as logger from "winston";

import {Kind} from "./models";

// Datastore
const datastore = Datastore();
const datastoreRunQuery = promisify(datastore.runQuery, {multiArgs: true, thisArg: datastore});

export const image = options => {
    const seneca = options.seneca;
    options.pin = "role:image";

    seneca.add({
            cmd: "get",
            path: "list",
            role: "image",
        },
        (msg, respond) => {
            const kind: Kind = "Image";
            const query = datastore.createQuery(kind);
            queryImages(query, "getImage").then(result => respond(null, { ok: true, result }));
        }
    );

    seneca.add({
            cmd: "getById",
            path: "load",
            role: "image",
        },
        (msg, respond) => {
            // respond(null, { ok: true, result: `I can now get images by id (and the current id is ${msg.id})` });
            const kind: Kind = "Image";
            const id: number =  +msg.id;
            const query = datastore.createQuery(kind)
                .filter("__key__", "=", datastore.key(["Image", id]));

            queryImages(query, "getImageById").then(result => respond(null, { ok: true, result: result[0] }));
        }
    );

    return {
        name: "image",
        options: {},
    };
};
export const imagePin: string = "role:image";

function queryImages(query, queryName): Promise<any> {
    console.time(queryName);

    return datastoreRunQuery(query)
        .then(result => {
            const images = result[0];
            const info = result[1];
            logger.debug("entities", JSON.stringify(images));
            logger.debug("info", JSON.stringify(info));
            console.timeEnd(queryName);

            return images.map( entity => {
                entity.id = entity[datastore.KEY].id;
                entity.thumbnail = process.env.IMAGES_URL + "/" + entity.id + "/thumbnail.jpg";
                entity.free = process.env.IMAGES_URL + "/" + entity.id + "/free.jpg";
                return entity;
            });
        });
        // TODO: somewhere lets try to catch the errors to don't repeat ourself.
        // .catch(error => respond(null, { ok: false, result: error}));
}
