import { api } from "./api";

process.chdir(__dirname);

let server = api.listen(process.env.PORT || "8080", () => {
    console.log("App listening on port %s", server.address().port);
    console.log("Press CtrlC to quit.");
});
