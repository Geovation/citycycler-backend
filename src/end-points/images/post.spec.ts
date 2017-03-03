import * as Auth from "../../common/auth";
import * as Datastore from "../../common/datastore";
import { service } from "./post";

import * as logger from "winston";

describe("images: post", () => {
    let loggerError;
    const error = "some error";

    beforeEach(() => {
        loggerError = spyOn(logger, "error");
    });

    it("not owner rejected fail", done => {
        spyOn(Auth, "isOwner").and.returnValue(Promise.reject(error));

        service(null, {})
            .then(() => {
                throw "It didn't reject";
            })
            .catch( err => {
                expect(err).toBe(error);
                expect(loggerError).toHaveBeenCalledWith(error);
                done();
            });
    });

    it("datastore fails", done => {
        spyOn(Auth, "isOwner").and.returnValue(Promise.resolve());
        spyOn(Datastore, "saveImageMetadata").and.returnValue(Promise.reject(error));

        service(null, {body: { metadata: {}}})
            .then(() => {
                throw "It didn't reject";
            })
            .catch( err => {
                expect(err).toBe(error);
                expect(loggerError).toHaveBeenCalledWith(error);
                done();
            });
    });

    it("resizeImage fails", done => {
        const id = 1;
        const imageResultModel = { id };
        spyOn(Auth, "isOwner").and.returnValue(Promise.resolve());
        spyOn(Datastore, "saveImageMetadata").and.returnValue(Promise.resolve(imageResultModel));
        const deleteImageMetadata = spyOn(Datastore, "deleteImageMetadata").and.returnValue(Promise.resolve());

        function broadcast() {
            return Promise.reject(error);
        }

        service(broadcast, {body: { metadata: {}}})
            .then(() => {
                throw "It didn't reject";
            })
            .catch( err => {
                expect(err).toBe(error);
                expect(deleteImageMetadata).toHaveBeenCalledWith(id);
                expect(loggerError).toHaveBeenCalledWith({err: error, id});
                done();
            });
    });
});
