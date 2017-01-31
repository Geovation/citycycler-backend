import * as Datastore from "@google-cloud/datastore";
import * as promisify from "es6-promisify";
import * as firebaseAdmin from "firebase-admin";
import * as _ from "lodash";
import * as logger from "winston";

import {Kind} from "./models";

// Datastore
const datastore = Datastore();
const datastoreRunQuery = promisify(datastore.runQuery, {multiArgs: true, thisArg: datastore});
const kind: Kind = "User";

export const user = options => {
    const seneca = options.seneca;
    options.pin = "role:user";

    seneca.add({
            cmd: "getById",
            path: "load",
            role: "user",
        },
        (msg, respond) => {
            const id: string = msg.params.id;
            const idToken: string = msg.params.idtoken;

            firebaseAdmin.auth().verifyIdToken(idToken)
                .then( decodedToken => {
                    if (decodedToken.uid === id) {
                        const query = datastore.createQuery(kind)
                            .filter("__key__", "=", datastore.key([kind, id]));

                        console.time("getUserById");
                        datastoreRunQuery(query)
                            .then(result => {
                                const users = result[0];
                                const info = result[1];
                                logger.debug("entities", JSON.stringify(users));
                                logger.debug("info", JSON.stringify(info));
                                console.timeEnd("getUserById");

                                respond(null, { ok: true, result: _.extend({}, users[0]) });
                            });
                    } else {
                        const errorMsg = `${decodedToken.uid} is not allowed to read user ${id}`;
                        console.log(errorMsg);
                        respond(null, { ok: true, result: errorMsg });
                    }
                })
                .catch( error => {
                    const errorMsg = `Server error:  ${error}`;
                    console.log(errorMsg);
                    respond(null, { ok: true, result: errorMsg });
                });
        }
    );

    return {
        name: "user",
        options: {},
    };
};
export const userPin: string = "role:user";

// Init firebase
firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert("conf/key-file.json"),
    databaseURL: process.env.FIREBASE_URL,
});
