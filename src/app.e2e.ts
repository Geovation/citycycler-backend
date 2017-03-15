// import { config } from "./microservices-framework/config";
import { app, gracefulShutdown, setupServer } from "./microservices-framework/web/server";
import * as chai from "chai";
import * as EventEmitter from "events";
import * as request from "request";

const expect = chai.expect;

describe("MatchMyRoute API", () => {
    const startServer = !process.env.URL;
    // const url = process.env.URL || "http://localhost:8080";
    let server;
    let result = {
        body: null,
        error: null,
        response: null,
    };
    let origin = "*";
    beforeAll(done => {
        class AppEmitter extends EventEmitter { };
        const appEmitter = new AppEmitter();
        setupServer(appEmitter);
        appEmitter.on("ready", () => {
            if (startServer) {
                server = app.listen(process.env.PORT || "8080", () => {
                    console.log("App listening on port %s", server.address().port);
                    console.log("Press Ctrl+C to quit.");
                    finalDone();
                });

            } else {
                finalDone();
            }
        });

        function finalDone() {
            request({
                headers: {
                    Origin: "https://www.example.com",
                },
                url: "http://localhost:8080",
            },
                (error, response, body) => {
                    result.error = error;
                    result.response = response;
                    result.body = body;
                    done();
                });
        }
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
        it("error not null", () => {
            expect(result.error).to.be.null;
            expect(result.response.statusCode).to.equal(200);
        });

        it("CORS is enabled", () => {
            expect(result.response.headers["access-control-allow-origin"]).to.equal(origin);
        });
    });

    describe("Routes", () => {
        let validRouteId;
        describe("Valid route creation", () => {
            request({
                headers: {
                    Origin: "https://www.example.com",
                },
                json: {
                    averageSpeed: 10,
                    departureTime: 8500,
                    owner: 1,
                    route: [[0, 0], [1, 0], [1, 1]],
                },
                method: "POST",
                url: "http://localhost:8080/route",
            }, (error, response, body) => {
                it("should return 200", (done) => {
                    expect(response.statusCode).to.equal(200);
                    done();
                });
                it("should return valid JSON", (done) => {
                    expect(() => { JSON.parse(body); }).not.toThrow();
                    done();
                });
                it("should return an integer Route ID", (done) => {
                    expect(() => { parseInt(JSON.parse(body).result, 10); }).not.to.equal(NaN);
                    done();
                });

                //validRouteId = parseInt(JSON.parse(body).result, 10);
            });
        });
    });
});
