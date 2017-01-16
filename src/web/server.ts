import * as Koa from "koa";
import * as bodyParser from "koa-bodyparser";
import * as qs from "koa-qs";
import * as Router from "koa-router";
import * as cors from "koa2-cors";

// local modules
import * as middleware from "./middleware";

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
});

app
    .use(router.routes())
    .use(router.allowedMethods());

app.use(cors({
  headers: ["Content-Type", "api_key", "Authorization"],
  methods: ["GET", "HEAD", "POST", "DELETE", "PUT", "PATCH", "OPTIONS"],
  origin: "*",
}));

app.use(middleware.handleErrors());
app.use(bodyParser());

// response
app.use(async (ctx, next) => {
    await next();

    ctx.body = JSON.stringify({
        node: process.versions,
        test: "Hello Koa async multi-process using middleware",
    });
});
/*
app.use(async (ctx, next) => {
    await next();
    if (this.path === "/api") {
      ctx.body = await swagger();
    }
});// */
