import * as Koa from "koa";
import * as cors from "koa-cors";
import * as KoaQs from "koa-qs";
import * as Router from "koa-router";
import * as serve from "koa-static";
import * as path from "path";
import * as Seneca from "seneca";
import * as SenecaWeb from "seneca-web";
import * as senecaWebAdapter from "seneca-web-adapter-koa1";
import * as logger from "winston";

// local modules
import * as middleware from "../web/middleware";
import { closeServices, senecaReady, servicesHelper } from "../web/services";
import { getSwaggerJsonGenerator } from "../web/swagger";

export const app = new Koa();

export const setupServer = (eventEmitter) => {
    // enable qs for query string parsing
    KoaQs(app, "strict");

    app
        .use(middleware.handleErrors())
        .use(cors({
            headers: ["content-type", "api_key", "Authorization", "idtoken"],
            methods: ["GET", "HEAD", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
            origin: "*",
        }));

    // serve files in public folder (css, js etc)
    app.use(serve(path.join(process.cwd(), process.env.STATIC_DIR || "build/static")));

    // Seneca setup
    const senecaWebConfig = {
        adapter: senecaWebAdapter,
        context: Router(),
        options: { parseBody: false },
        routes: servicesHelper.endpointCollection.senecaRoutes(),
    };
    const options: Seneca.Options = {
        debug: {
            undead: true,
        },
        tag: "web",
    };
    const seneca = Seneca(options);

    seneca.use(SenecaWeb, senecaWebConfig)
        .use(servicesHelper.api, { fatal$: false, seneca });

    seneca.ready(() => {
        // we need this to stop Typescript borking!
        const senecaExport: any = seneca.export("web/context");
        app.use(senecaExport().routes());

        /* tslint:disable only-arrow-functions */
        app.use(function* (next) {
            if (this.path === "/swagger.json") {
                try {

                    this.body = yield getSwaggerJsonGenerator;
                } catch (err) {
                    this.status = 500;
                    return {
                        detail: err,
                        error: "Failed to parse swagger.json",
                        path: this.request.url,
                        status: this.status,
                    };
                }
            } else {
                yield next;
            }
        });

        app.use(function* (next) {
            yield next;

            this.body = JSON.stringify({
                node: process.versions,
                test: "Hello Koa async multi-process using middleware",
            });
        });
        /* tslint:enable only-arrow-functions */

        // Wait until the seneca listener is active
        senecaReady.then(() => {
            logger.info("seneca ready");
            eventEmitter.emit("ready");
        });
    });
};

export const gracefulShutdown = () => closeServices();
