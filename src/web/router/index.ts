import * as Router from "koa-router";

// local modules
import * as api from "./api";

export const router = new Router();

// endpoints
router.get(`/api/v0${api.photos.endpoint}`, api.photos.get);
