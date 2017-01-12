import { app } from "./server";
import * as request from "request";

const API_KEY = "AIzaSyDOzTdHFHxAiBm52HDlqz_AkHX7rZ3VFIg";

describe("Timepix API", () => {
    const startServer = !process.env.URL;
    const url = process.env.URL || "http://localhost:8081";
    let server;
    let result = {
        body: null,
        error: null,
        response: null,
    };
    let origin = "https://www.example.com";
    beforeAll(done => {
        if ( startServer ) {
            server = app.listen(process.env.PORT || "8081", () => {
                console.log("App listening on port %s", server.address().port);
                console.log("Press Ctrl+C to quit.");
                finalDone();
            });

        } else {
            finalDone();
        }

        function finalDone() {
            const username = "timepix";
            const password = "TimepixRocks!";
            const auth = "Basic " + new Buffer(username + ":" + password).toString("base64");
            request({
                headers:  {
                    Authorization: auth,
                    Origin: origin,
                },
                url: url + "/api/v0/?key=" + API_KEY,
            }, (error, response, body) => {
                    result.error = error;
                    result.response = response;
                    result.body = error ? body : JSON.parse(body);
                    done();
            });
        }
    });

    afterAll(done => {
        if ( startServer ) {
            console.log("Shutting down server...");
            server.close(() => {
                console.log("done.");
                done();
            });
        } else {
            done();
        }
    });

    describe("root level", () => {
        it("error not null", () => {
            expect(result.error).toBe(null);
            expect(result.response.statusCode).toEqual(200);
        });

        it("CORS is enabled", () => {
            expect(result.response.headers["access-control-allow-origin"]).toBe(origin);
        });
    });

});
