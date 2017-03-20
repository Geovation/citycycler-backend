import { route } from "./route";
import { nearby } from "./route/nearby";
import { users } from "./users";
import { auth as authUser } from "./users/auth";

export const endpoints = [route, nearby, users, authUser];
