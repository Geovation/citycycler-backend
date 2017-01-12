import * as Koa from "koa";
import * as cors from "koa2-cors";

export const app = new Koa();

app.use(cors());

// response
app.use(async (ctx, next) => {
    await next();

    ctx.body = JSON.stringify({
        node: process.versions,
        test: "Hello Koa async multi-process",
    });
});
