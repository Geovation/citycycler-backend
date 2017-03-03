import { callResizeFn } from "./resize";
import { SharpInstance } from "sharp";
import createSpyObj = jasmine.createSpyObj;

describe("images: resize", () => {
    let md;
    let sharp: SharpInstance;

    beforeEach(() => {
        sharp = createSpyObj("SharpInstance", ["resize"]);
        md = {
            height: 5000,
            width: 4000,
        };
    });

    function expectLongestSide(pSharp, size) {
        const max = Math.max(md.width, md.height);
        const w = Math.round(size * md.width / max);
        const h = Math.round(size * md.height / max);

        expect(pSharp.resize).toHaveBeenCalledWith(w, h);
    }

    it("business is 100% original", () => {
        callResizeFn.business(sharp, md);
        expect(sharp.resize).toHaveBeenCalledWith(md.width, md.height);
    });

    it("business is 100% original also for small images", () => {
        md.width = 30;
        md.height = 70;
        callResizeFn.business(sharp, md);
        expect(sharp.resize).toHaveBeenCalledWith(md.width, md.height);
    });

    it("thumbnail is 100px the longest side", () => {
        callResizeFn.thumbnail(sharp, md);
        expectLongestSide(sharp, 100);
    });

    it("thumbnail is 100px the longest side also for small images", () => {
        md.width = 30;
        md.height = 70;
        callResizeFn.thumbnail(sharp, md);
        expectLongestSide(sharp, 100);
    });

    it("cc is 1080px the longest side", () => {
        callResizeFn.cc(sharp, md);
        expectLongestSide(sharp, 1080);
    });

    it("cc is 1080px the longest side also for small images", () => {
        md.width = 30;
        md.height = 70;
        callResizeFn.cc(sharp, md);
        expectLongestSide(sharp, 1080);
    });

    it("personal is 1500px the longest side", () => {
        callResizeFn.personal(sharp, md);
        expectLongestSide(sharp, 1500);
    });

    it("personal is 1500px the longest side also for small images", () => {
        md.width = 30;
        md.height = 70;
        callResizeFn.personal(sharp, md);
        expectLongestSide(sharp, 1500);
    });
});
