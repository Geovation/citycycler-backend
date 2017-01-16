import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import * as qs from "koa-qs";
import * as Router from "koa-router";
import * as serve from "koa-static";
import * as cors from "koa2-cors";
import * as path from "path";

// local modules
import * as middleware from "./middleware";
import getSwaggerJson from "./swagger";

export const app = new Koa();

// enable qs for query string parsing
qs(app, "strict");

// TODO: to integrate with swagger (??)
let hardCodedPhotos = [
    "Pokémon Yellow",
    "Super Metroid",
    "Mega Man X",
    "The Legend of Zelda",
    "Pac-Man",
    "Super Mario World",
    "Street Fighter II",
    "Half Life",
    "Final Fantasy VII",
    "Star Fox",
    "Tetris",
    "Donkey Kong III",
    "GoldenEye 007",
    "Doom",
    "Fallout",
    "GTA",
    "Halo",
];
let router = new Router();
router.get("/api/v0/photos",  (ctx, next) => {
    ctx.body = hardCodedPhotos;
    next();
});

app
    .use(router.routes())
    .use(router.allowedMethods());

app.use(cors({
  allowHeaders: ["content-type", "api_key", "Authorization"],
  allowMethods: ["GET", "HEAD", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
  origin: "*",
}));

app.use(bodyParser());
app.use(middleware.handleErrors());

// serve files in public folder (css, js etc)
app.use(serve(path.join(__dirname, "../static")));

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
