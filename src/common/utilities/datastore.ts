import * as Datastore from "@google-cloud/datastore";
import * as promisify from "es6-promisify";
import * as logger from "winston";

// Datastore
export const datastore = Datastore();
export const datastoreRunQuery = promisify(datastore.runQuery, {multiArgs: true, thisArg: datastore});
export const queryImages = (query, queryName): Promise<any> => {
    console.time(queryName);

    return datastoreRunQuery(query)
        .then( (result) => {
            const images = result[0];
            const info = result[1];
            logger.debug("entities", JSON.stringify(images));
            logger.debug("info", JSON.stringify(info));
            console.timeEnd(queryName);

            return images.map( (entity) => {
                entity.id = entity[datastore.KEY].id;
                entity.thumbnail = process.env.IMAGES_URL + "/" + entity.id + "/thumbnail.jpg";
                entity.free = process.env.IMAGES_URL + "/" + entity.id + "/free.jpg";
                return entity;
            });
        });
        // TODO: somewhere lets try to catch the errors to don't repeat ourself.
        // .catch(error => respond(null, { ok: false, result: error}));
};
