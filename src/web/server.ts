import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import * as qs from "koa-qs";
import * as serve from "koa-static";
import * as cors from "koa2-cors";
import * as path from "path";

// local modules
import * as middleware from "./middleware";
import { router } from "./router";
import getSwaggerJson from "./swagger";

export const app = new Koa();

// enable qs for query string parsing
qs(app, "strict");

app
    .use(bodyParser())
    .use(middleware.handleErrors())
    .use(cors({
      allowHeaders: ["content-type", "api_key", "Authorization"],
      allowMethods: ["GET", "HEAD", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
      origin: "*",
    }));

// serve files in public folder (css, js etc)
app.use(serve(path.join(__dirname, "../static")));

// serve files from router endpoints
app.use(router.middleware());

// response
app.use(async (ctx, next) => {
    if (ctx.path === "/swagger.json") {
        console.log(ctx);
        try {
            ctx.body = await getSwaggerJson();
        } catch (err) {
            ctx.status = 500;
            return {
                detail: err,
                error: "Failed to parse swagger.json",
                path: ctx.request.url,
                status: ctx.status,
            };
        }
    } else {
        await next();
    }
});

app.use(async (ctx, next) => {
    await next();

    ctx.body = JSON.stringify({
        node: process.versions,
        test: "Hello Koa async multi-process using middleware",
    });
});
