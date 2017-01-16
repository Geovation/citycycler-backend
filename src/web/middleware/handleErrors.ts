import * as Koa from "koa";
import * as _ from "lodash";

/* tslint:disable only-arrow-functions */
// tslint only allows arrow functions by default and async doesn"t play well with arrow functions
export function handleErrorsFactory (): Koa.Middleware {
  return async function handleErrors (ctx: Koa.Context, next ): Promise<any> {
    // formats error according to Swagger error definition (web/router/swagger/index)
    const formatError = (err) => {
      ctx.status = err.status || 500;
      return {
        detail: (err.isJoi ? err.details : err),
        error: err.message,
        path: ctx.request.url,
        status: ctx.status,
      };
    };
    try {
      await next();
      // deal with microservice responses
      if (ctx.body && _.has(ctx.body, "ok")) {
        if (!ctx.body.ok) {
          ctx.body = formatError(ctx.body.err);
        } else {
          ctx.body = _.omit(ctx.body, ["ok"]);
        }
      }
    } catch (err) {
      ctx.body = formatError(err);
    }
  };
};
