// import { config } from "./microservices-framework/config";
import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import * as chai from "chai";
import * as EventEmitter from "events";
import * as request from "request";

const expect = chai.expect;

describe("MatchMyRoute API", () => {
    const startServer = !process.env.URL;
    const url = process.env.URL || "http://localhost:8080";
    let server;
    beforeAll(done => {
        class AppEmitter extends EventEmitter { };
        const appEmitter = new AppEmitter();
        setupServer(appEmitter);
        appEmitter.on("ready", () => {
            if (startServer) {
                console.log("Starting server");
                // Set up some environment variables for the server (they only persist until the end of the node task)
                server = app.listen(process.env.PORT || "8080", () => {
                    console.log("App listening on port %s", server.address().port);
                    console.log("Press Ctrl+C to quit.");
                    done();
                });
            }
        });
    });

    afterAll(done => {
        if (startServer) {
            console.log("Shutting down server...");
            gracefulShutdown();
            server.close((err) => {
                console.log("done.");
                done();
            });
        } else {
            done();
        }
    });

    describe("root level", () => {
        it("error to be null", done => {
            request({
                headers: {
                    Origin: "https://www.example.com",
                },
                url,
            }, (error, response, body) => {
                expect(error).to.be.null;
                expect(response.statusCode).to.equal(200);
                done();
            });
        });

        it("CORS to be enabled", done => {
            request({
                headers: {
                    Origin: "https://www.example.com",
                },
                url,
            }, (error, response, body) => {
                expect(response.headers["access-control-allow-origin"]).to.equal("*");
                done();
            });
        });
    });

    describe("Routes", () => {
        let validRouteId;
        describe("Valid route creation", () => {
            it("should create a valid route", done => {
                request({
                    json: {
                        averageSpeed: 10,
                        departureTime: 8500,
                        owner: 1,
                        route: [[0, 0], [1, 0], [1, 1]],
                    },
                    method: "POST",
                    url: url + "/api/v0/route",
                }, (error, response, body) => {
                    expect(response.statusCode).to.equal(200);
                    expect(error).to.be.null;
                    expect(typeof body).to.equal("object");
                    expect(parseInt(body.result, 10)).not.NaN;
                    // Save this route ID so we can use it later
                    validRouteId = parseInt(body.result, 10);
                    done();
                });
            });
        });
        describe("Route retreival by ID", () => {
            it("should get back the route that we just made", done => {
                request({
                    url: url + "/api/v0/route?id=" + validRouteId,
                }, (error, response, body) => {
                    expect(response.statusCode).to.equal(200);
                    expect(typeof body).to.equal("string");
                    let route = {
                        averageSpeed: 10,
                        departureTime: 8500,
                        owner: 1,
                        route: [[0, 0], [1, 0], [1, 1]],
                    };
                    expect(JSON.parse(body).result).to.contain.all.keys(route);
                    expect(JSON.parse(body).result).to.contain.all.keys(["id"]);
                    done();
                });
            });
            it("should return a 500 when we use an invalid ID", done => {
                request({
                    url: url + "/api/v0/route?id=-1",   // -1 should always be an invalid id
                }, (error, response, body) => {
                    expect(response.statusCode).to.equal(500);
                    done();
                });
            });
        });
    });
});
