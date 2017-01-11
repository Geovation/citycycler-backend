import * as Koa from "koa";
import * as cors from "koa2-cors";

export const api = new Koa();
api.use(cors());

// response
api.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms =  <any> (new Date()) - <any> start;
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);

    ctx.body = JSON.stringify({
        node: process.versions,
        test: "Hello Koa async",
    });
});
