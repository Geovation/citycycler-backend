import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import { senecaReady } from "./microservices-framework/web/services";
import * as chai from "chai";
import * as EventEmitter from "events";
import * as firebase from "firebase";
import * as _ from "lodash";
import * as mocha from "mocha";
import * as rp from "request-promise-native";
import * as logger from "winston";

const expect = chai.expect;
const before = mocha.before;
const after = mocha.after;
const describe = mocha.describe;
const it = mocha.it;

// A default request wrapper, to make our lives easier
// since we only change some things in our requests
const defaultRequest = (options): Promise<any> => {
    // Pack in some defaults
    _.defaults(options,
        {
            headers: {
                Origin: "https://www.example.com",
            },
            json: true,
            resolveWithFullResponse: true,
            simple: false,
        });
    return rp(options);
};

const deleteE2EUsers = (url): Promise<Boolean> => {
    return defaultRequest({
        method: "GET",
        url: url + "/clearE2EObjects",
    }).then(response => {
        if (response.statusCode !== 200) {
            logger.error("Got error when trying to delete the e2e test users: " + JSON.stringify(response));
        }
        return true;
    });
};

// initialize firebase client library to be able to sign in and get JWT

initFirebaseClient();

function initFirebaseClient() {
    const config = {
      apiKey: "AIzaSyBZGqBeXHwe8g4PH2d5xMe2s4GpZSMAdpQ",
      authDomain: "matchmyroute-backend.firebaseapp.com",
      databaseURL: "https://matchmyroute-backend.firebaseio.com",
      messagingSenderId: "858623040089",
      projectId: "matchmyroute-backend",
      storageBucket: "matchmyroute-backend.appspot.com",
    };
    firebase.initializeApp(config);

}

const startServer = !process.env.URL;
const url = (process.env.URL || "http://localhost:8080") + "/api/v0";
let server;
// These before and after blocks are root hooks, they will be run before any test code in any file - cool!
/* tslint:disable only-arrow-functions */
before(function(done) { // Must not be an arrow function because we need access to `this`
    this.timeout(0);    // Disable timeouts for the server startup
    logger.info("startServer is: " + startServer);
    if (startServer) {
        class AppEmitter extends EventEmitter { };
        const appEmitter = new AppEmitter();
        setupServer(appEmitter);
        appEmitter.on("ready", () => {
            logger.info("Starting server");
            server = app.listen(process.env.PORT || "8080", () => {
                logger.debug("App listening on port %s", server.address().port);
                deleteE2EUsers(url).then(() => {
                    done();
                });
            });
        });
    } else {
        senecaReady.then(() => {
            deleteE2EUsers(url).then(() => {
                done();
            });
        });
    }
});
/* tslint:enable only-arrow-functions */

after(done => {
    logger.info("Cleaning up...");
    deleteE2EUsers(url).then(() => {
        if (startServer) {
            console.log("Shutting down server...");
            gracefulShutdown();
            server.close((err) => {
                console.log("done.");
                done();
            });
        } else {
            gracefulShutdown();
            done();
        }
    });
});

describe("MatchMyRoute API Tests", () => {
    it("should resolve with a 200", () => {
        return defaultRequest({
            url,
        }).then(response => {
            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + JSON.stringify(response));
        });
    });
    it("should have CORS enabled", () => {
        rp({
            headers: {
                Origin: "https://www.example.com",
            },
            json: true,
            resolveWithFullResponse: true,
            url,
        }).then(response => {
            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + response.error + " body returned is: " +
                JSON.stringify(response.body));
            expect(response.headers["access-control-allow-origin"]).to.equal("*");
        });
    });
    it("should have a valid Swagger schema", () => {
        return defaultRequest({
            url: "http://online.swagger.io/validator/debug?url=" +
            "https://matchmyroute-backend.appspot.com/swagger.json",
        }).then(response => {
            expect(response.statusCode).to.equal(200, "Expected 200 response but got " +
                response.statusCode + ", error given is: " + JSON.stringify(response));
            expect(response.body).to.eql({}, "Got swagger validation errors: " + JSON.stringify(response.body));
        });
    });
});
