import * as Datastore from "@google-cloud/datastore";
import * as promisify from "es6-promisify";
import * as logger from "winston";

// Datastore
const datastore = Datastore();
const datastoreRunQuery = promisify(datastore.runQuery, {multiArgs: true, thisArg: datastore});

export const image = options => {
    const seneca = options.seneca;

    seneca.add("role:image,cmd:get", (msg, respond) => {
        console.time("getPhotos");
        const kind = "Image";
        const query = datastore.createQuery(kind);
        datastoreRunQuery(query)
            .then(result => {
                logger.debug("entities", JSON.stringify(result[0]));
                logger.debug("info", JSON.stringify(result[1]));
                console.timeEnd("getPhotos");
                respond(null, { ok: true, result: result[0] });
            });
    });

    return {
        name: "image",
        options: {},
    };
};
