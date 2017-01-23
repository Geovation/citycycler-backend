import * as Datastore from "@google-cloud/datastore";
import * as promisify from "es6-promisify";
import * as logger from "winston";

// Datastore
const datastore = Datastore();
const datastoreRunQuery = promisify(datastore.runQuery, {multiArgs: true, thisArg: datastore});

export const image = options => {
    const seneca = options.seneca;
    options.pin = "role:image";

    seneca.add("role:image,cmd:get", (msg, respond) => {
        console.time("getPhotos");
        const kind = "Image";
        const query = datastore.createQuery(kind);
        datastoreRunQuery(query)
            .then(result => {
                logger.debug("entities", JSON.stringify(result[0]));
                logger.debug("info", JSON.stringify(result[1]));
                console.timeEnd("getPhotos");

                const entities = result[0].map( entity => {
                    entity.id = entity[datastore.KEY].id;
                    entity.thumbnail = process.env.IMAGES_URL + "/" + entity.id + "/thumbnail.jpg";
                    entity.free = process.env.IMAGES_URL + "/" + entity.id + "/free.jpg";
                    return entity;
                });

                respond(null, { ok: true, result: entities });
            });
    });

    return {
        name: "image",
        options: {},
    };
};
export const imagePin: string = "role:image";
